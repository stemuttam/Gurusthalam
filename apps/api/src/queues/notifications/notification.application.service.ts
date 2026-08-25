import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';

import {
  NotificationQueueService,
  type NotificationEnqueueOptions,
  type NotificationEnqueueResult,
} from './notification.queue.js';

import {
  NotificationOrchestrationService,
  type NotificationOrchestrationResult,
} from './notification.orchestration.service.js';

import type {
  NotificationJobData,
  NotificationJsonValue,
} from './notification.types.js';

import type {
  CreateNotificationCommand,
  NotificationCommandChannel,
} from './notification.command.js';

type SingleChannelNotificationCommand =
  CreateNotificationCommand & {
    readonly channel:
      NotificationCommandChannel;

    readonly channels?:
      never;
  };

type MultiChannelNotificationCommand =
  CreateNotificationCommand & {
    readonly channel?:
      never;

    readonly channels:
      readonly NotificationCommandChannel[];
  };

@Injectable()
export class NotificationApplicationService {
  constructor(
    private readonly queue:
      NotificationQueueService,

    @Optional()
    private readonly orchestration?:
      NotificationOrchestrationService,
  ) {}

  async create(
    command:
      SingleChannelNotificationCommand,
  ):
    Promise<NotificationEnqueueResult>;

  async create(
    command:
      MultiChannelNotificationCommand,
  ):
    Promise<NotificationOrchestrationResult>;

  /*
   * Broad compatibility overload.
   *
   * Existing tests and internal callers frequently hold a
   * CreateNotificationCommand-typed value instead of a narrowed
   * discriminated command. Keep that usage valid without weakening
   * the two precise overloads above.
   */
  async create(
    command:
      CreateNotificationCommand,
  ):
    Promise<
      NotificationEnqueueResult |
      NotificationOrchestrationResult
    >;

  async create(
    command:
      CreateNotificationCommand,
  ):
    Promise<
      NotificationEnqueueResult |
      NotificationOrchestrationResult
    > {
    this.validateCommand(
      command,
    );

    const channels =
      this.resolveChannels(
        command,
      );

    const data =
      channels.map(
        (
          channel,
        ) =>
          this.toNotificationJobData(
            command,
            channel,
            channels.length >
              1,
          ),
      );

    if (
      data.length ===
      1
    ) {
      const enqueueOptions:
        NotificationEnqueueOptions =
        command.template?.locale !==
        undefined
          ? {
              locale:
                command.template.locale,
            }
          : {};

      const first =
        data[0];

      if (
        first ===
        undefined
      ) {
        throw new BadRequestException(
          'Notification channel resolution produced no notification data.',
        );
      }

      return this.queue.enqueue(
        first,

        enqueueOptions,
      );
    }

    const orchestration =
      this.orchestration ??
      new NotificationOrchestrationService(
        this.queue,
      );

    const enqueueOptions:
      NotificationEnqueueOptions =
      command.template?.locale !==
      undefined
        ? {
            locale:
              command.template.locale,
          }
        : {};

    return orchestration.fanOut(
      command.notificationId.trim(),

      data,

      enqueueOptions,
    );
  }

  async getByNotificationId(
    notificationId:
      string,
  ) {
    return this.queue.getByNotificationId(
      notificationId,
    );
  }

  private validateCommand(
    command:
      CreateNotificationCommand,
  ):
    void {
    this.validateRequiredIdentity(
      command,
    );

    this.validateRecipientIdentity(
      command,
    );

    const channels =
      this.resolveChannels(
        command,
      );

    for (
      const channel of
        channels
    ) {
      this.validateChannelRecipient(
        command,

        channel,
      );
    }

    this.validateContentMode(
      command,
    );
  }

  private resolveChannels(
    command:
      CreateNotificationCommand,
  ):
    readonly NotificationCommandChannel[] {
    const hasChannel =
      command.channel !==
      undefined;

    const hasChannels =
      command.channels !==
      undefined;

    if (
      hasChannel ===
      hasChannels
    ) {
      throw new BadRequestException(
        'Exactly one of channel or channels must be provided.',
      );
    }

    if (
      hasChannel
    ) {
      return [
        command.channel as NotificationCommandChannel,
      ];
    }

    const channels =
      command.channels;

    if (
      channels ===
        undefined ||
      channels.length ===
        0
    ) {
      throw new BadRequestException(
        'channels must be a non-empty array.',
      );
    }

    if (
      new Set(
        channels,
      ).size !==
      channels.length
    ) {
      throw new BadRequestException(
        'channels must not contain duplicates.',
      );
    }

    return [
      ...channels,
    ];
  }

  private validateRequiredIdentity(
    command:
      CreateNotificationCommand,
  ):
    void {
    if (
      typeof command.notificationId !==
        'string' ||
      command.notificationId.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'notificationId is required.',
      );
    }

    if (
      typeof command.userId !==
        'string' ||
      command.userId.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'userId is required.',
      );
    }

    if (
      typeof command.idempotencyKey !==
        'string' ||
      command.idempotencyKey.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'idempotencyKey is required.',
      );
    }
  }

  private validateRecipientIdentity(
    command:
      CreateNotificationCommand,
  ):
    void {
    if (
      typeof command.recipient?.userId !==
        'string' ||
      command.recipient.userId.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'recipient.userId is required.',
      );
    }

    if (
      command.recipient.userId !==
      command.userId
    ) {
      throw new BadRequestException(
        'recipient.userId must match userId.',
      );
    }
  }

  private validateChannelRecipient(
    command:
      CreateNotificationCommand,

    channel:
      NotificationCommandChannel,
  ):
    void {
    switch (
      channel
    ) {
      case 'email':
        this.validateEmailRecipient(
          command.recipient.email,
        );

        return;

      case 'push':
        this.validatePushRecipient(
          command.recipient.deviceTokens,
        );

        return;

      case 'in-app':
        return;

      default:
        this.assertNeverChannel(
          channel,
        );
    }
  }

  private validateEmailRecipient(
    email:
      string | undefined,
  ):
    void {
    if (
      email ===
        undefined ||
      email.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'An email recipient is required for email notifications.',
      );
    }

    const normalized =
      email.trim();

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        normalized,
      )
    ) {
      throw new BadRequestException(
        'recipient.email must be a valid email address.',
      );
    }
  }

  private validatePushRecipient(
    deviceTokens:
      readonly string[] |
      undefined,
  ):
    void {
    if (
      deviceTokens ===
        undefined ||
      deviceTokens.length ===
        0
    ) {
      throw new BadRequestException(
        'At least one device token is required for push notifications.',
      );
    }

    const normalizedTokens =
      deviceTokens.map(
        (
          token,
        ) =>
          token.trim(),
      );

    if (
      normalizedTokens.some(
        (
          token,
        ) =>
          token.length ===
          0,
      )
    ) {
      throw new BadRequestException(
        'Push notification device tokens cannot be empty.',
      );
    }

    const uniqueTokens =
      new Set(
        normalizedTokens,
      );

    if (
      uniqueTokens.size !==
      normalizedTokens.length
    ) {
      throw new BadRequestException(
        'Push notification device tokens must be unique.',
      );
    }
  }

  private validateContentMode(
    command:
      CreateNotificationCommand,
  ):
    void {
    const hasTemplate =
      command.template !==
      undefined;

    const hasContent =
      command.content !==
      undefined;

    if (
      hasTemplate ===
      hasContent
    ) {
      throw new BadRequestException(
        'Exactly one of template or content must be provided.',
      );
    }

    if (
      hasTemplate
    ) {
      this.validateTemplateCommand(
        command.template,
      );
    }

    if (
      hasContent
    ) {
      this.validateLiteralContent(
        command.content,
      );
    }
  }

  private validateTemplateCommand(
    template:
      NonNullable<
        CreateNotificationCommand['template']
      >,
  ):
    void {
    if (
      typeof template.templateId !==
        'string' ||
      template.templateId.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'template.templateId is required.',
      );
    }

    if (
      template.templateData ===
      null ||
      typeof template.templateData !==
        'object' ||
      Array.isArray(
        template.templateData,
      )
    ) {
      throw new BadRequestException(
        'template.templateData must be a JSON object.',
      );
    }

    if (
      template.locale !==
        undefined &&
      (
        typeof template.locale !==
          'string' ||
        template.locale.trim()
          .length ===
          0
      )
    ) {
      throw new BadRequestException(
        'template.locale cannot be empty.',
      );
    }
  }

  private validateLiteralContent(
    content:
      NonNullable<
        CreateNotificationCommand['content']
      >,
  ):
    void {
    if (
      typeof content.body !==
        'string' ||
      content.body.trim()
        .length ===
        0
    ) {
      throw new BadRequestException(
        'Notification body cannot be empty.',
      );
    }

    if (
      content.subject !==
        undefined &&
      (
        typeof content.subject !==
          'string' ||
        content.subject.trim()
          .length ===
          0
      )
    ) {
      throw new BadRequestException(
        'Notification subject cannot be empty when supplied.',
      );
    }

    if (
      content.title !==
        undefined &&
      (
        typeof content.title !==
          'string' ||
        content.title.trim()
          .length ===
          0
      )
    ) {
      throw new BadRequestException(
        'Notification title cannot be empty when supplied.',
      );
    }
  }

  private toNotificationJobData(
    command:
      CreateNotificationCommand,

    channel:
      NotificationCommandChannel,

    multiChannel:
      boolean,
  ):
    NotificationJobData {
    const baseNotificationId =
      command.notificationId.trim();

    const baseIdempotencyKey =
      command.idempotencyKey.trim();

    const notificationId =
      multiChannel
        ? `${baseNotificationId}:${channel}`
        : baseNotificationId;

    const idempotencyKey =
      multiChannel
        ? `${baseIdempotencyKey}:${channel}`
        : baseIdempotencyKey;

    const base:
      NotificationJobData = {
      notificationId,

      channel,

      recipient: {
        userId:
          command.recipient.userId.trim(),

        ...(command.recipient.email !==
        undefined
          ? {
              email:
                command.recipient.email.trim(),
            }
          : {}),

        ...(command.recipient.deviceTokens !==
        undefined
          ? {
              deviceTokens:
                command.recipient.deviceTokens.map(
                  (
                    token,
                  ) =>
                    token.trim(),
                ),
            }
          : {}),
      },

      body:
        command.content?.body.trim() ??
        '',

      idempotencyKey,
    };

    if (
      command.content !==
      undefined
    ) {
      return {
        ...base,

        ...(command.content.subject !==
        undefined
          ? {
              subject:
                command.content.subject.trim(),
            }
          : {}),

        ...(command.content.title !==
        undefined
          ? {
              title:
                command.content.title.trim(),
            }
          : {}),
      };
    }

    if (
      command.template ===
      undefined
    ) {
      throw new BadRequestException(
        'A template or literal notification content is required.',
      );
    }

    return {
      ...base,

      template:
        command.template.templateId.trim(),

      templateData:
        this.toNotificationJsonObject(
          command.template.templateData,
        ),
    };
  }

  private toNotificationJsonObject(
    value:
      Record<
        string,
        unknown
      >,
  ):
    NonNullable<
      NotificationJobData['templateData']
    > {
    const output:
      NonNullable<
        NotificationJobData['templateData']
      > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value,
      )
    ) {
      output[key] =
        this.toNotificationJsonValue(
          item,
        );
    }

    return output;
  }

  private toNotificationJsonValue(
    value:
      unknown,
  ):
    NotificationJsonValue {
    if (
      value ===
      null
    ) {
      return null;
    }

    if (
      typeof value ===
        'string' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }

    if (
      typeof value ===
      'number'
    ) {
      if (
        !Number.isFinite(
          value,
        )
      ) {
        throw new BadRequestException(
          'templateData contains a non-finite number.',
        );
      }

      return value;
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value.map(
        (
          item,
        ) =>
          this.toNotificationJsonValue(
            item,
          ),
      );
    }

    if (
      typeof value ===
      'object'
    ) {
      return this.toNotificationJsonObject(
        value as Record<
          string,
          unknown
        >,
      );
    }

    throw new BadRequestException(
      `templateData contains an unsupported value type: ${typeof value}.`,
    );
  }

  private assertNeverChannel(
    channel:
      never,
  ):
    never {
    throw new BadRequestException(
      `Unsupported notification channel: ${String(channel)}.`,
    );
  }
}