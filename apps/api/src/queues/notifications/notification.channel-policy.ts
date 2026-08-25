import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';

import type {
  NotificationCommandChannel,
} from './notification.command.js';

export const NOTIFICATION_CHANNEL_POLICY_CONFIG =
  'NOTIFICATION_CHANNEL_POLICY_CONFIG';

export interface NotificationChannelPolicyConfig {
  readonly allowedChannels?:
    readonly NotificationCommandChannel[];

  readonly preferredOrder?:
    readonly NotificationCommandChannel[];

  readonly minimumChannels?:
    number;

  readonly maximumChannels?:
    number;

  readonly mandatoryChannels?:
    readonly NotificationCommandChannel[];

  readonly mutuallyExclusiveChannels?:
    readonly (
      readonly [
        NotificationCommandChannel,
        NotificationCommandChannel,
      ]
    )[];
}

export interface NotificationChannelPolicyResult {
  readonly channels:
    readonly NotificationCommandChannel[];
}

const DEFAULT_ALLOWED_CHANNELS:
  readonly NotificationCommandChannel[] = [
    'email',
    'push',
    'in-app',
  ];

const DEFAULT_PREFERRED_ORDER:
  readonly NotificationCommandChannel[] = [
    'email',
    'push',
    'in-app',
  ];

function uniqueChannels(
  channels:
    readonly NotificationCommandChannel[],
):
  NotificationCommandChannel[] {
  return [
    ...new Set(
      channels,
    ),
  ];
}

function hasDuplicateChannels(
  channels:
    readonly NotificationCommandChannel[],
):
  boolean {
  return (
    new Set(
      channels,
    ).size !==
    channels.length
  );
}

@Injectable()
export class NotificationChannelPolicy {
  private readonly allowedChannels:
    readonly NotificationCommandChannel[];

  private readonly preferredOrder:
    readonly NotificationCommandChannel[];

  private readonly minimumChannels:
    number;

  private readonly maximumChannels:
    number;

  private readonly mandatoryChannels:
    readonly NotificationCommandChannel[];

  private readonly mutuallyExclusiveChannels:
    readonly (
      readonly [
        NotificationCommandChannel,
        NotificationCommandChannel,
      ]
    )[];

  constructor(
    @Inject(
      NOTIFICATION_CHANNEL_POLICY_CONFIG,
    )
    config:
      NotificationChannelPolicyConfig = {},
  ) {
    this.allowedChannels =
      uniqueChannels(
        config.allowedChannels ??
          DEFAULT_ALLOWED_CHANNELS,
      );

    this.preferredOrder =
      uniqueChannels(
        config.preferredOrder ??
          this.allowedChannels.filter(
            (
              channel,
            ) =>
              DEFAULT_PREFERRED_ORDER.includes(
                channel,
              ),
          ),
      );

    this.minimumChannels =
      Math.max(
        1,
        Math.floor(
          config.minimumChannels ??
            1,
        ),
      );

    this.maximumChannels =
      Math.min(
        this.allowedChannels.length,
        Math.max(
          this.minimumChannels,
          Math.floor(
            config.maximumChannels ??
              this.allowedChannels.length,
          ),
        ),
      );

    this.mandatoryChannels =
      uniqueChannels(
        config.mandatoryChannels ??
          [],
      );

    this.mutuallyExclusiveChannels =
      config.mutuallyExclusiveChannels ??
      [];

    this.validatePolicyConfiguration();
  }

  evaluate(
    requestedChannels:
      readonly NotificationCommandChannel[],
  ):
    NotificationChannelPolicyResult {
    if (
      requestedChannels.length ===
      0
    ) {
      throw new BadRequestException(
        'At least one notification channel must be selected.',
      );
    }

    if (
      hasDuplicateChannels(
        requestedChannels,
      )
    ) {
      throw new BadRequestException(
        'Notification channels must not contain duplicates.',
      );
    }

    const channels =
      [
        ...requestedChannels,
      ];

    if (
      channels.length <
      this.minimumChannels
    ) {
      throw new BadRequestException(
        `At least ${this.minimumChannels} notification channel${
          this.minimumChannels === 1
            ? ''
            : 's'
        } must be selected.`,
      );
    }

    if (
      channels.length >
      this.maximumChannels
    ) {
      throw new BadRequestException(
        `At most ${this.maximumChannels} notification channel${
          this.maximumChannels === 1
            ? ''
            : 's'
        } may be selected.`,
      );
    }

    for (
      const channel of
        channels
    ) {
      if (
        !this.allowedChannels.includes(
          channel,
        )
      ) {
        throw new BadRequestException(
          `Notification channel "${channel}" is not allowed by the channel policy.`,
        );
      }
    }

    for (
      const mandatoryChannel of
        this.mandatoryChannels
    ) {
      if (
        !channels.includes(
          mandatoryChannel,
        )
      ) {
        throw new BadRequestException(
          `Notification channel "${mandatoryChannel}" is mandatory for this channel policy.`,
        );
      }
    }

    for (
      const [
        first,
        second,
      ] of
        this.mutuallyExclusiveChannels
    ) {
      if (
        channels.includes(
          first,
        ) &&
        channels.includes(
          second,
        )
      ) {
        throw new BadRequestException(
          `Notification channels "${first}" and "${second}" cannot be selected together.`,
        );
      }
    }

    return {
      channels:
        this.orderChannels(
          channels,
        ),
    };
  }

  getAllowedChannels():
    readonly NotificationCommandChannel[] {
    return [
      ...this.allowedChannels,
    ];
  }

  getPreferredOrder():
    readonly NotificationCommandChannel[] {
    return [
      ...this.preferredOrder,
    ];
  }

  private orderChannels(
    channels:
      readonly NotificationCommandChannel[],
  ):
    NotificationCommandChannel[] {
    const priority =
      new Map<
        NotificationCommandChannel,
        number
      >(
        this.preferredOrder.map(
          (
            channel,
            index,
          ) => [
            channel,
            index,
          ],
        ),
      );

    return [
      ...channels,
    ].sort(
      (
        left,
        right,
      ) =>
        (
          priority.get(
            left,
          ) ??
          Number.MAX_SAFE_INTEGER
        ) -
        (
          priority.get(
            right,
          ) ??
          Number.MAX_SAFE_INTEGER
        ),
    );
  }

  private validatePolicyConfiguration():
    void {
    if (
      this.allowedChannels.length ===
      0
    ) {
      throw new Error(
        'Channel policy must allow at least one notification channel.',
      );
    }

    if (
      this.minimumChannels >
      this.maximumChannels
    ) {
      throw new Error(
        'Channel policy minimumChannels cannot exceed maximumChannels.',
      );
    }

    for (
      const channel of
        this.preferredOrder
    ) {
      if (
        !this.allowedChannels.includes(
          channel,
        )
      ) {
        throw new Error(
          `Preferred channel "${channel}" must also be allowed by the channel policy.`,
        );
      }
    }

    for (
      const channel of
        this.mandatoryChannels
    ) {
      if (
        !this.allowedChannels.includes(
          channel,
        )
      ) {
        throw new Error(
          `Mandatory channel "${channel}" must also be allowed by the channel policy.`,
        );
      }
    }

    if (
      this.mandatoryChannels.length >
      this.maximumChannels
    ) {
      throw new Error(
        'Channel policy cannot require more mandatory channels than maximumChannels.',
      );
    }

    for (
      const [
        first,
        second,
      ] of
        this.mutuallyExclusiveChannels
    ) {
      if (
        !this.allowedChannels.includes(
          first,
        ) ||
        !this.allowedChannels.includes(
          second,
        )
      ) {
        throw new Error(
          `Mutually exclusive channels "${first}" and "${second}" must both be allowed by the channel policy.`,
        );
      }

      if (
        first ===
        second
      ) {
        throw new Error(
          'A channel cannot be mutually exclusive with itself.',
        );
      }
    }
  }
}