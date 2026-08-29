import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import type {
  NotificationJobData,
  NotificationJsonValue,
  NotificationRecipient,
} from './notification.types.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationSourceEvent,
} from './notification-aggregation.source-event.resolver.js';

export interface NotificationAggregationBuildInput {
  readonly group: NotificationAggregationRepositoryGroup;

  readonly items:
    readonly NotificationAggregationRepositoryItem[];

  readonly sourceEvents:
    readonly NotificationAggregationSourceEvent[];
}

@Injectable()
export class NotificationAggregationBuilder {
  /**
   * Builds one immutable NotificationJobData object from an
   * aggregation group and its resolved source events.
   *
   * Source NotificationJobData objects are never mutated.
   *
   * Source events must already be supplied in the same
   * deterministic ordering as the persisted aggregation items.
   */
  build(
    input: NotificationAggregationBuildInput,
  ): NotificationJobData {
    this.validateInput(input);

    const {
      group,
      items,
      sourceEvents,
    } = input;

    if (
      items.length === 0
    ) {
      throw new BadRequestException(
        `Notification aggregation "${group.aggregationId}" contains no items.`,
      );
    }

    if (
      sourceEvents.length !==
      items.length
    ) {
      throw new BadRequestException(
        `Notification aggregation "${group.aggregationId}" has ${items.length} items but ${sourceEvents.length} resolved source events.`,
      );
    }

    this.validateSourceEventOrder(
      items,
      sourceEvents,
    );

    const first =
      this.requireFirstSourceEvent(
        sourceEvents,
        group.aggregationId,
      );

    this.validateCompatibleEvents(
      group,
      sourceEvents,
    );

    const notificationId =
      this.createNotificationId(
        group,
      );

    const idempotencyKey =
      this.createIdempotencyKey(
        group,
      );

    const body =
      this.buildBody(
        sourceEvents,
      );

    const recipient =
      this.buildRecipient(
        sourceEvents,
      );

    return {
      notificationId,

      channel:
        first.data.channel,

      recipient,

      ...(this.buildOptionalSubject(
        sourceEvents,
      )),

      ...(this.buildOptionalTitle(
        sourceEvents,
      )),

      body,

      ...(this.buildOptionalTemplate(
        sourceEvents,
      )),

      ...(this.buildOptionalTemplateVersion(
        sourceEvents,
      )),

      ...(this.buildOptionalTemplateLocale(
        sourceEvents,
      )),

      ...(this.buildOptionalTemplateData(
        sourceEvents,
      )),

      ...(this.buildOptionalTemplateSnapshot(
        sourceEvents,
      )),

      ...(this.buildOptionalFallbackMetadata(
        sourceEvents,
      )),

      idempotencyKey,
    };
  }

  private validateInput(
    input: NotificationAggregationBuildInput,
  ): void {
    if (
      input === null ||
      input === undefined ||
      typeof input !== 'object'
    ) {
      throw new BadRequestException(
        'Notification aggregation build input is required.',
      );
    }

    if (
      input.group === null ||
      input.group === undefined
    ) {
      throw new BadRequestException(
        'Notification aggregation group is required.',
      );
    }

    if (
      !Array.isArray(input.items)
    ) {
      throw new BadRequestException(
        'Notification aggregation items must be an array.',
      );
    }

    if (
      !Array.isArray(input.sourceEvents)
    ) {
      throw new BadRequestException(
        'Notification aggregation source events must be an array.',
      );
    }
  }

  private requireFirstSourceEvent(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
    aggregationId: string,
  ): NotificationAggregationSourceEvent {
    const first =
      sourceEvents.at(0);

    if (
      first === undefined
    ) {
      throw new BadRequestException(
        `Notification aggregation "${aggregationId}" contains no resolvable source event.`,
      );
    }

    return first;
  }

  private validateSourceEventOrder(
    items:
      readonly NotificationAggregationRepositoryItem[],
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ): void {
    const itemIds =
      items.map(
        (item) =>
          item.sourceEventId,
      );

    const sourceIds =
      sourceEvents.map(
        (event) =>
          event.sourceEventId,
      );

    for (
      let index = 0;
      index < itemIds.length;
      index += 1
    ) {
      if (
        itemIds[index] !==
        sourceIds[index]
      ) {
        throw new BadRequestException(
          `Resolved source event ordering does not match aggregation item ordering at index ${index}.`,
        );
      }
    }
  }

  private validateCompatibleEvents(
    group:
      NotificationAggregationRepositoryGroup,
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ): void {
    const first =
      this.requireFirstSourceEvent(
        sourceEvents,
        group.aggregationId,
      );

    const expectedChannel =
      group.channel;

    if (
      first.data.channel !==
      expectedChannel
    ) {
      throw new BadRequestException(
        `Source event "${first.sourceEventId}" has channel "${first.data.channel}" but aggregation group "${group.aggregationId}" uses channel "${expectedChannel}".`,
      );
    }

    if (
      first.data.recipient.userId !==
      group.userId
    ) {
      throw new BadRequestException(
        `Source event "${first.sourceEventId}" belongs to user "${first.data.recipient.userId}" but aggregation group "${group.aggregationId}" belongs to user "${group.userId}".`,
      );
    }

    for (
      const event of sourceEvents
    ) {
      if (
        event.data.channel !==
        expectedChannel
      ) {
        throw new BadRequestException(
          `Source event "${event.sourceEventId}" has channel "${event.data.channel}" but aggregation group "${group.aggregationId}" uses channel "${expectedChannel}".`,
        );
      }

      if (
        event.data.recipient.userId !==
        group.userId
      ) {
        throw new BadRequestException(
          `Source event "${event.sourceEventId}" belongs to user "${event.data.recipient.userId}" but aggregation group "${group.aggregationId}" belongs to user "${group.userId}".`,
        );
      }
    }
  }

  private buildBody(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ): string {
    return sourceEvents
      .map(
        (event) =>
          event.data.body,
      )
      .join('\n');
  }

  private buildRecipient(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ): NotificationRecipient {
    const first =
      this.requireFirstSourceEvent(
        sourceEvents,
        'unknown',
      );

    const recipients =
      sourceEvents.map(
        (event) =>
          event.data.recipient,
      );

    const userId =
      first.data.recipient.userId;

    for (
      const recipient of recipients
    ) {
      if (
        recipient.userId !==
        userId
      ) {
        throw new BadRequestException(
          'All aggregation source events must belong to the same recipient user.',
        );
      }
    }

    const email =
      recipients.find(
        (recipient) =>
          recipient.email !==
          undefined,
      )?.email;

    const deviceTokens =
      this.mergeDeviceTokens(
        recipients,
      );

    return {
      userId,

      ...(email !== undefined
        ? {
            email,
          }
        : {}),

      ...(deviceTokens.length > 0
        ? {
            deviceTokens,
          }
        : {}),
    };
  }

  private mergeDeviceTokens(
    recipients:
      readonly NotificationRecipient[],
  ): readonly string[] {
    const tokens =
      new Set<string>();

    for (
      const recipient of recipients
    ) {
      for (
        const token of
          recipient.deviceTokens ??
          []
      ) {
        tokens.add(token);
      }
    }

    return [
      ...tokens,
    ];
  }

  private buildOptionalSubject(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | { readonly subject: string }
    | Record<string, never> {
    const subject =
      this.getConsistentOptionalString(
        sourceEvents,
        (data) =>
          data.subject,
        'subject',
      );

    return subject === undefined
      ? {}
      : {
          subject,
        };
  }

  private buildOptionalTitle(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | { readonly title: string }
    | Record<string, never> {
    const title =
      this.getConsistentOptionalString(
        sourceEvents,
        (data) =>
          data.title,
        'title',
      );

    return title === undefined
      ? {}
      : {
          title,
        };
  }

  private buildOptionalTemplate(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | { readonly template: string }
    | Record<string, never> {
    const template =
      this.getConsistentOptionalString(
        sourceEvents,
        (data) =>
          data.template,
        'template',
      );

    return template === undefined
      ? {}
      : {
          template,
        };
  }

  private buildOptionalTemplateVersion(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | { readonly templateVersion: number }
    | Record<string, never> {
    const values =
      sourceEvents
        .map(
          (event) =>
            event.data
              .templateVersion,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== undefined,
        );

    const first =
      values.at(0);

    if (
      first === undefined
    ) {
      return {};
    }

    if (
      values.some(
        (value) =>
          value !== first,
      )
    ) {
      throw new BadRequestException(
        'Aggregation source events contain inconsistent templateVersion values.',
      );
    }

    return {
      templateVersion:
        first,
    };
  }

  private buildOptionalTemplateLocale(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | { readonly templateLocale: string }
    | Record<string, never> {
    const value =
      this.getConsistentOptionalString(
        sourceEvents,
        (data) =>
          data.templateLocale,
        'templateLocale',
      );

    return value === undefined
      ? {}
      : {
          templateLocale:
            value,
        };
  }

  private buildOptionalTemplateData(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | {
        readonly templateData: {
          [key: string]:
            NotificationJsonValue;
        };
      }
    | Record<string, never> {
    const values =
      sourceEvents
        .map(
          (event) =>
            event.data
              .templateData,
        )
        .filter(
          (
            value,
          ): value is {
            [key: string]:
              NotificationJsonValue;
          } =>
            value !== undefined,
        );

    const first =
      values.at(0);

    if (
      first === undefined
    ) {
      return {};
    }

    if (
      values.some(
        (value) =>
          !this.jsonEquals(
            value,
            first,
          ),
      )
    ) {
      throw new BadRequestException(
        'Aggregation source events contain inconsistent templateData values.',
      );
    }

    return {
      templateData:
        first,
    };
  }

  private buildOptionalTemplateSnapshot(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | {
        readonly templateSnapshot:
          NonNullable<
            NotificationJobData[
              'templateSnapshot'
            ]
          >;
      }
    | Record<string, never> {
    const values =
      sourceEvents
        .map(
          (event) =>
            event.data
              .templateSnapshot,
        )
        .filter(
          (
            value,
          ): value is NonNullable<
            NotificationJobData[
              'templateSnapshot'
            ]
          > =>
            value !== undefined,
        );

    const first =
      values.at(0);

    if (
      first === undefined
    ) {
      return {};
    }

    if (
      values.some(
        (value) =>
          !this.jsonEquals(
            value,
            first,
          ),
      )
    ) {
      throw new BadRequestException(
        'Aggregation source events contain inconsistent templateSnapshot values.',
      );
    }

    return {
      templateSnapshot:
        first,
    };
  }

  private buildOptionalFallbackMetadata(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
  ):
    | {
        readonly fallbackMetadata:
          NonNullable<
            NotificationJobData[
              'fallbackMetadata'
            ]
          >;
      }
    | Record<string, never> {
    const values =
      sourceEvents
        .map(
          (event) =>
            event.data
              .fallbackMetadata,
        )
        .filter(
          (
            value,
          ): value is NonNullable<
            NotificationJobData[
              'fallbackMetadata'
            ]
          > =>
            value !== undefined,
        );

    const first =
      values.at(0);

    if (
      first === undefined
    ) {
      return {};
    }

    if (
      values.some(
        (value) =>
          !this.jsonEquals(
            value,
            first,
          ),
      )
    ) {
      throw new BadRequestException(
        'Aggregation source events contain inconsistent fallbackMetadata values.',
      );
    }

    return {
      fallbackMetadata:
        first,
    };
  }

  private getConsistentOptionalString(
    sourceEvents:
      readonly NotificationAggregationSourceEvent[],
    selector: (
      data: NotificationJobData,
    ) => string | undefined,
    field: string,
  ): string | undefined {
    const values =
      sourceEvents
        .map(
          (event) =>
            selector(event.data),
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== undefined,
        );

    const first =
      values.at(0);

    if (
      first === undefined
    ) {
      return undefined;
    }

    if (
      values.some(
        (value) =>
          value !== first,
      )
    ) {
      throw new BadRequestException(
        `Aggregation source events contain inconsistent ${field} values.`,
      );
    }

    return first;
  }

  private createNotificationId(
    group:
      NotificationAggregationRepositoryGroup,
  ): string {
    return `aggregation-${this.stableHash(
      group.aggregationId,
    )}`;
  }

  private createIdempotencyKey(
    group:
      NotificationAggregationRepositoryGroup,
  ): string {
    return `notification-aggregation:${group.aggregationId}`;
  }

  private stableHash(
    value: string,
  ): string {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^= value.charCodeAt(
        index,
      );

      hash = Math.imul(
        hash,
        16777619,
      );
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(8, '0');
  }

  private jsonEquals(
    left: unknown,
    right: unknown,
  ): boolean {
    return (
      JSON.stringify(left) ===
      JSON.stringify(right)
    );
  }
}