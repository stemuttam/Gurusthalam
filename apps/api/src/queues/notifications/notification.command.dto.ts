import {
  randomUUID,
} from 'node:crypto';

import {
  BadRequestException,
} from '@nestjs/common';

import type {
  CreateNotificationCommand,
  NotificationCommandChannel,
  NotificationCommandRecipient,
  NotificationLiteralContent,
  NotificationTemplateCommand,
} from './notification.command.js';

export interface CreateNotificationHttpRequest {
  readonly notificationId?: unknown;

  readonly userId?: unknown;

  readonly channel?: unknown;

  readonly channels?: unknown;

  readonly recipient?: unknown;

  readonly idempotencyKey?: unknown;

  readonly template?: unknown;

  readonly content?: unknown;
}

export function parseCreateNotificationHttpRequest(
  request:
    unknown,
):
  CreateNotificationCommand {
  if (
    !isRecord(
      request,
    )
  ) {
    throw new BadRequestException(
      'Request body must be a JSON object.',
    );
  }

  rejectUnknownKeys(
    request,
    [
      'notificationId',
      'userId',
      'channel',
      'channels',
      'recipient',
      'idempotencyKey',
      'template',
      'content',
    ],
    'notification request',
  );

  const userId =
    readRequiredString(
      request.userId,
      'userId',
    );

  const channel =
    request.channel !==
    undefined
      ? readChannel(
          request.channel,
        )
      : undefined;

  const channels =
    request.channels !==
    undefined
      ? readChannels(
          request.channels,
        )
      : undefined;

  if (
    channel ===
      undefined &&
    channels ===
      undefined
  ) {
    throw new BadRequestException(
      'Exactly one of channel or channels must be provided.',
    );
  }

  if (
    channel !==
      undefined &&
    channels !==
      undefined
  ) {
    throw new BadRequestException(
      'Exactly one of channel or channels must be provided.',
    );
  }

  const recipient =
    readRecipient(
      request.recipient,
    );

  const idempotencyKey =
    readRequiredString(
      request.idempotencyKey,
      'idempotencyKey',
    );

  const notificationId =
    readOptionalString(
      request.notificationId,
      'notificationId',
    ) ??
    createNotificationId();

  const template =
    request.template !==
    undefined
      ? readTemplate(
          request.template,
        )
      : undefined;

  const content =
    request.content !==
    undefined
      ? readContent(
          request.content,
        )
      : undefined;

  return {
    notificationId,

    userId,

    ...(channel !==
    undefined
      ? {
          channel,
        }
      : {}),

    ...(channels !==
    undefined
      ? {
          channels,
        }
      : {}),

    recipient,

    idempotencyKey,

    ...(template !==
    undefined
      ? {
          template,
        }
      : {}),

    ...(content !==
    undefined
      ? {
          content,
        }
      : {}),
  };
}

function readRecipient(
  value:
    unknown,
):
  NotificationCommandRecipient {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new BadRequestException(
      'recipient must be a JSON object.',
    );
  }

  rejectUnknownKeys(
    value,
    [
      'userId',
      'email',
      'deviceTokens',
    ],
    'recipient',
  );

  const userId =
    readRequiredString(
      value.userId,
      'recipient.userId',
    );

  const email =
    readOptionalString(
      value.email,
      'recipient.email',
    );

  const deviceTokens =
    readOptionalStringArray(
      value.deviceTokens,
      'recipient.deviceTokens',
    );

  return {
    userId,

    ...(email !==
    undefined
      ? {
          email,
        }
      : {}),

    ...(deviceTokens !==
    undefined
      ? {
          deviceTokens,
        }
      : {}),
  };
}

function readTemplate(
  value:
    unknown,
):
  NotificationTemplateCommand {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new BadRequestException(
      'template must be a JSON object.',
    );
  }

  rejectUnknownKeys(
    value,
    [
      'templateId',
      'templateData',
      'locale',
    ],
    'template',
  );

  const templateId =
    readRequiredString(
      value.templateId,
      'template.templateId',
    );

  if (
    !isRecord(
      value.templateData,
    )
  ) {
    throw new BadRequestException(
      'template.templateData must be a JSON object.',
    );
  }

  const locale =
    readOptionalString(
      value.locale,
      'template.locale',
    );

  return {
    templateId,

    templateData:
      value.templateData,

    ...(locale !==
    undefined
      ? {
          locale,
        }
      : {}),
  };
}

function readContent(
  value:
    unknown,
):
  NotificationLiteralContent {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new BadRequestException(
      'content must be a JSON object.',
    );
  }

  rejectUnknownKeys(
    value,
    [
      'subject',
      'title',
      'body',
    ],
    'content',
  );

  const body =
    readRequiredString(
      value.body,
      'content.body',
    );

  const subject =
    readOptionalString(
      value.subject,
      'content.subject',
    );

  const title =
    readOptionalString(
      value.title,
      'content.title',
    );

  return {
    body,

    ...(subject !==
    undefined
      ? {
          subject,
        }
      : {}),

    ...(title !==
    undefined
      ? {
          title,
        }
      : {}),
  };
}

function readChannel(
  value:
    unknown,
):
  NotificationCommandChannel {
  if (
    value !==
      'email' &&
    value !==
      'push' &&
    value !==
      'in-app'
  ) {
    throw new BadRequestException(
      'channel must be one of: email, push, in-app.',
    );
  }

  return value;
}

function readChannels(
  value:
    unknown,
):
  readonly NotificationCommandChannel[] {
  if (
    !Array.isArray(
      value,
    ) ||
    value.length ===
      0
  ) {
    throw new BadRequestException(
      'channels must be a non-empty array.',
    );
  }

  const channels =
    value.map(
      (
        item,
        index,
      ) => {
        try {
          return readChannel(
            item,
          );
        } catch (
          error: unknown
        ) {
          if (
            error instanceof
            BadRequestException
          ) {
            throw new BadRequestException(
              `channels[${index}] ${error.message}`,
            );
          }

          throw error;
        }
      },
    );

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

  return channels;
}

function readRequiredString(
  value:
    unknown,

  fieldName:
    string,
):
  string {
  if (
    typeof value !==
      'string' ||
    value.trim()
      .length ===
      0
  ) {
    throw new BadRequestException(
      `${fieldName} is required.`,
    );
  }

  return value.trim();
}

function readOptionalString(
  value:
    unknown,

  fieldName:
    string,
):
  string | undefined {
  if (
    value ===
    undefined
  ) {
    return undefined;
  }

  if (
    typeof value !==
      'string' ||
    value.trim()
      .length ===
      0
  ) {
    throw new BadRequestException(
      `${fieldName} must be a non-empty string when supplied.`,
    );
  }

  return value.trim();
}

function readOptionalStringArray(
  value:
    unknown,

  fieldName:
    string,
):
  readonly string[] |
  undefined {
  if (
    value ===
    undefined
  ) {
    return undefined;
  }

  if (
    !Array.isArray(
      value,
    )
  ) {
    throw new BadRequestException(
      `${fieldName} must be an array of strings.`,
    );
  }

  return value.map(
    (
      item,
      index,
    ) => {
      if (
        typeof item !==
        'string'
      ) {
        throw new BadRequestException(
          `${fieldName}[${index}] must be a string.`,
        );
      }

      return item;
    },
  );
}

function rejectUnknownKeys(
  value:
    Record<
      string,
      unknown
    >,

  allowedKeys:
    readonly string[],

  objectName:
    string,
):
  void {
  const allowed =
    new Set(
      allowedKeys,
    );

  for (
    const key of Object.keys(
      value,
    )
  ) {
    if (
      !allowed.has(
        key,
      )
    ) {
      throw new BadRequestException(
        `Unknown property "${key}" in ${objectName}.`,
      );
    }
  }
}

function isRecord(
  value:
    unknown,
):
  value is Record<
    string,
    unknown
  > {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function createNotificationId():
  string {
  return `notification-${randomUUID()}`;
}
