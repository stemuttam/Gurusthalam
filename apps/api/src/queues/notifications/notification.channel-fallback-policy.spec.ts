import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BadRequestException,
} from '@nestjs/common';

import {
  NotificationChannelFallbackPolicy,
} from './notification.channel-fallback-policy.js';

import {
  NotificationChannelPolicy,
} from './notification.channel-policy.js';

describe(
  'NotificationChannelFallbackPolicy',
  () => {
    const createChannelPolicy =
      (
        config:
          ConstructorParameters<
            typeof NotificationChannelPolicy
          >[0] =
            {},
      ) =>
        new NotificationChannelPolicy(
          config,
        );

    it(
      'creates a deterministic primary-to-fallback sequence',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy();

        const result =
          fallbackPolicy.createPlan(
            'email',

            [
              'push',
              'in-app',
            ],

            channelPolicy,
          );

        expect(
          result.primary,
        ).toBe(
          'email',
        );

        expect(
          result.fallbacks,
        ).toEqual([
          'push',
          'in-app',
        ]);

        expect(
          result.sequence,
        ).toEqual([
          'email',
          'push',
          'in-app',
        ]);
      },
    );

    it(
      'preserves explicit fallback order',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy();

        const result =
          fallbackPolicy.createPlan(
            'in-app',

            [
              'push',
              'email',
            ],

            channelPolicy,
          );

        expect(
          result.sequence,
        ).toEqual([
          'in-app',
          'push',
          'email',
        ]);
      },
    );

    it(
      'allows a primary channel without fallbacks',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy();

        const result =
          fallbackPolicy.createPlan(
            'email',
            [],
            channelPolicy,
          );

        expect(
          result.primary,
        ).toBe(
          'email',
        );

        expect(
          result.fallbacks,
        ).toEqual([]);

        expect(
          result.sequence,
        ).toEqual([
          'email',
        ]);
      },
    );

    it(
      'rejects a primary channel that is not allowed by the channel policy',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy({
            allowedChannels: [
              'email',
              'push',
            ],
          });

        expect(
          () =>
            fallbackPolicy.createPlan(
              'in-app',
              [],
              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channel "in-app" is not allowed by the channel policy.',
          ),
        );
      },
    );

    it(
      'rejects a fallback channel that is not allowed by the channel policy',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy({
            allowedChannels: [
              'email',
              'push',
            ],
          });

        expect(
          () =>
            fallbackPolicy.createPlan(
              'email',

              [
                'in-app',
              ],

              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channel "in-app" is not allowed by the channel policy.',
          ),
        );
      },
    );

    it(
      'rejects the primary channel from appearing in fallbacks',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy();

        expect(
          () =>
            fallbackPolicy.createPlan(
              'email',

              [
                'push',
                'email',
              ],

              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'Fallback channel "email" cannot be the primary channel.',
          ),
        );
      },
    );

    it(
      'rejects duplicate fallback channels',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy();

        expect(
          () =>
            fallbackPolicy.createPlan(
              'email',

              [
                'push',
                'push',
              ],

              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'Notification fallback channels must not contain duplicates.',
          ),
        );
      },
    );

    it(
      'enforces the maximum fallback count',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy({
            maximumFallbackChannels:
              1,
          });

        const channelPolicy =
          createChannelPolicy();

        expect(
          () =>
            fallbackPolicy.createPlan(
              'email',

              [
                'push',
                'in-app',
              ],

              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'At most 1 fallback channel may be configured.',
          ),
        );
      },
    );

    it(
      'allows zero fallback channels when configured',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy({
            maximumFallbackChannels:
              0,
          });

        const channelPolicy =
          createChannelPolicy();

        const result =
          fallbackPolicy.createPlan(
            'email',
            [],
            channelPolicy,
          );

        expect(
          result.sequence,
        ).toEqual([
          'email',
        ]);
      },
    );

    it(
      'rejects fallback sequences containing mutually-exclusive channels',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy();

        const channelPolicy =
          createChannelPolicy({
            mutuallyExclusiveChannels: [
              [
                'email',
                'push',
              ],
            ],
          });

        expect(
          () =>
            fallbackPolicy.createPlan(
              'email',

              [
                'push',
              ],

              channelPolicy,
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channels "email" and "push" cannot be selected together.',
          ),
        );
      },
    );

    it(
      'rejects an invalid fallback-policy mutual-exclusion configuration',
      () => {
        expect(
          () =>
            new NotificationChannelFallbackPolicy({
              mutuallyExclusiveChannels: [
                [
                  'email',
                  'push',
                ],
              ],
            }).createPlan(
              'email',
              [
                'push',
              ],
              createChannelPolicy(),
            ),
        ).toThrow(
          new BadRequestException(
            'Notification fallback sequence cannot contain mutually-exclusive channels "email" and "push".',
          ),
        );
      },
    );

    it(
      'rejects a self-exclusive fallback-policy configuration',
      () => {
        expect(
          () =>
            new NotificationChannelFallbackPolicy({
              mutuallyExclusiveChannels: [
                [
                  'email',
                  'email',
                ],
              ],
            }),
        ).toThrow(
          'A fallback channel cannot be mutually exclusive with itself.',
        );
      },
    );

    it(
      'rejects a self-exclusive channel policy configuration',
      () => {
        expect(
          () =>
            createChannelPolicy({
              mutuallyExclusiveChannels: [
                [
                  'email',
                  'email',
                ],
              ],
            }),
        ).toThrow(
          'A channel cannot be mutually exclusive with itself.',
        );
      },
    );

    it(
      'exposes the configured maximum fallback count',
      () => {
        const fallbackPolicy =
          new NotificationChannelFallbackPolicy({
            maximumFallbackChannels:
              1,
          });

        expect(
          fallbackPolicy.getMaximumFallbackChannels(),
        ).toBe(
          1,
        );
      },
    );
  },
);