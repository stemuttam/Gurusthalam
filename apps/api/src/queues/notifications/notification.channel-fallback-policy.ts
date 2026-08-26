import {
  BadRequestException,
} from '@nestjs/common';

import type {
  NotificationCommandChannel,
} from './notification.command.js';

import {
  NotificationChannelPolicy,
} from './notification.channel-policy.js';

export interface NotificationChannelFallbackPolicyConfig {
  readonly maximumFallbackChannels?:
    number;

  readonly mutuallyExclusiveChannels?:
    readonly (
      readonly [
        NotificationCommandChannel,
        NotificationCommandChannel,
      ]
    )[];
}

export interface NotificationChannelFallbackPlan {
  readonly primary:
    NotificationCommandChannel;

  readonly fallbacks:
    readonly NotificationCommandChannel[];

  readonly sequence:
    readonly NotificationCommandChannel[];
}

const DEFAULT_MAXIMUM_FALLBACK_CHANNELS =
  2;

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

export class NotificationChannelFallbackPolicy {
  private readonly maximumFallbackChannels:
    number;

  private readonly mutuallyExclusiveChannels:
    readonly (
      readonly [
        NotificationCommandChannel,
        NotificationCommandChannel,
      ]
    )[];

  constructor(
    config:
      NotificationChannelFallbackPolicyConfig =
        {},
  ) {
    this.maximumFallbackChannels =
      Math.max(
        0,
        Math.floor(
          config.maximumFallbackChannels ??
            DEFAULT_MAXIMUM_FALLBACK_CHANNELS,
        ),
      );

    this.mutuallyExclusiveChannels =
      config.mutuallyExclusiveChannels ??
      [];

    this.validateConfiguration();
  }

  createPlan(
    primary:
      NotificationCommandChannel,

    fallbacks:
      readonly NotificationCommandChannel[],

    channelPolicy:
      NotificationChannelPolicy,
  ):
    NotificationChannelFallbackPlan {
    /*
     * Fallback-specific validation must happen before
     * combined-sequence validation so callers receive the
     * most precise contract error.
     */

    if (
      hasDuplicateChannels(
        fallbacks,
      )
    ) {
      throw new BadRequestException(
        'Notification fallback channels must not contain duplicates.',
      );
    }

    if (
      fallbacks.length >
      this.maximumFallbackChannels
    ) {
      throw new BadRequestException(
        `At most ${this.maximumFallbackChannels} fallback channel${
          this.maximumFallbackChannels ===
          1
            ? ''
            : 's'
        } may be configured.`,
      );
    }

    for (
      const fallback of
        fallbacks
    ) {
      if (
        fallback ===
        primary
      ) {
        throw new BadRequestException(
          `Fallback channel "${fallback}" cannot be the primary channel.`,
        );
      }
    }

    /*
     * Validate the primary and fallbacks against the
     * authoritative channel policy only after the
     * fallback-specific invariants have passed.
     */
    channelPolicy.validateFallbackSequence(
      [
        primary,
        ...fallbacks,
      ],
    );

    this.validateConfiguredMutualExclusions(
      [
        primary,
        ...fallbacks,
      ],
    );

    return {
      primary,

      fallbacks: [
        ...fallbacks,
      ],

      sequence: [
        primary,
        ...fallbacks,
      ],
    };
  }

  getMaximumFallbackChannels():
    number {
    return this.maximumFallbackChannels;
  }

  private validateConfiguredMutualExclusions(
    sequence:
      readonly NotificationCommandChannel[],
  ):
    void {
    for (
      const [
        first,
        second,
      ] of
        this.mutuallyExclusiveChannels
    ) {
      /*
       * A self-exclusive rule is a configuration error,
       * not a runtime sequence error.
       */
      if (
        first ===
        second
      ) {
        throw new Error(
          'A fallback channel cannot be mutually exclusive with itself.',
        );
      }

      if (
        sequence.includes(
          first,
        ) &&
        sequence.includes(
          second,
        )
      ) {
        throw new BadRequestException(
          `Notification fallback sequence cannot contain mutually-exclusive channels "${first}" and "${second}".`,
        );
      }
    }
  }

  private validateConfiguration():
    void {
    if (
      this.maximumFallbackChannels <
      0
    ) {
      throw new Error(
        'maximumFallbackChannels cannot be negative.',
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
        first ===
        second
      ) {
        /*
         * Keep invalid self-exclusive configuration
         * deterministic and fail at construction time.
         */
        throw new Error(
          'A fallback channel cannot be mutually exclusive with itself.',
        );
      }
    }
  }
}