import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BadRequestException,
} from '@nestjs/common';

import {
  NotificationChannelPolicy,
} from './notification.channel-policy.js';

describe(
  'NotificationChannelPolicy',
  () => {
    it(
      'allows all default notification channels',
      () => {
        const policy =
          new NotificationChannelPolicy();

        expect(
          policy.evaluate(
            [
              'push',
              'email',
              'in-app',
            ],
          ).channels,
        ).toEqual([
          'email',
          'push',
          'in-app',
        ]);
      },
    );

    it(
      'canonicalizes channel order',
      () => {
        const policy =
          new NotificationChannelPolicy({
            preferredOrder: [
              'in-app',
              'email',
              'push',
            ],
          });

        expect(
          policy.evaluate(
            [
              'push',
              'email',
              'in-app',
            ],
          ).channels,
        ).toEqual([
          'in-app',
          'email',
          'push',
        ]);
      },
    );

    it(
      'derives the default preferred order from the allowed channels',
      () => {
        const policy =
          new NotificationChannelPolicy({
            allowedChannels: [
              'email',
              'push',
            ],
          });

        expect(
          policy.getPreferredOrder(),
        ).toEqual([
          'email',
          'push',
        ]);

        expect(
          policy.evaluate(
            [
              'push',
              'email',
            ],
          ).channels,
        ).toEqual([
          'email',
          'push',
        ]);
      },
    );

    it(
      'rejects channels that are not allowed',
      () => {
        const policy =
          new NotificationChannelPolicy({
            allowedChannels: [
              'email',
              'push',
            ],
          });

        expect(
          () =>
            policy.evaluate(
              [
                'email',
                'in-app',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channel "in-app" is not allowed by the channel policy.',
          ),
        );
      },
    );

    it(
      'enforces the minimum channel count',
      () => {
        const policy =
          new NotificationChannelPolicy({
            minimumChannels:
              2,
          });

        expect(
          () =>
            policy.evaluate(
              [
                'email',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'At least 2 notification channels must be selected.',
          ),
        );
      },
    );

    it(
      'enforces the maximum channel count',
      () => {
        const policy =
          new NotificationChannelPolicy({
            maximumChannels:
              2,
          });

        expect(
          () =>
            policy.evaluate(
              [
                'email',
                'push',
                'in-app',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'At most 2 notification channels may be selected.',
          ),
        );
      },
    );

    it(
      'enforces mandatory channels',
      () => {
        const policy =
          new NotificationChannelPolicy({
            mandatoryChannels: [
              'email',
            ],
          });

        expect(
          () =>
            policy.evaluate(
              [
                'push',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channel "email" is mandatory for this channel policy.',
          ),
        );
      },
    );

    it(
      'accepts a request containing mandatory channels',
      () => {
        const policy =
          new NotificationChannelPolicy({
            mandatoryChannels: [
              'email',
            ],
          });

        expect(
          policy.evaluate(
            [
              'push',
              'email',
            ],
          ).channels,
        ).toEqual([
          'email',
          'push',
        ]);
      },
    );

    it(
      'rejects mutually-exclusive channels',
      () => {
        const policy =
          new NotificationChannelPolicy({
            mutuallyExclusiveChannels: [
              [
                'email',
                'push',
              ],
            ],
          });

        expect(
          () =>
            policy.evaluate(
              [
                'email',
                'push',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channels "email" and "push" cannot be selected together.',
          ),
        );
      },
    );

    it(
      'rejects duplicate channels',
      () => {
        const policy =
          new NotificationChannelPolicy();

        expect(
          () =>
            policy.evaluate(
              [
                'email',
                'email',
                'push',
              ],
            ),
        ).toThrow(
          new BadRequestException(
            'Notification channels must not contain duplicates.',
          ),
        );
      },
    );

    it(
      'rejects an invalid explicit preferred-order configuration',
      () => {
        expect(
          () =>
            new NotificationChannelPolicy({
              allowedChannels: [
                'email',
              ],

              preferredOrder: [
                'push',
              ],
            }),
        ).toThrow(
          'Preferred channel "push" must also be allowed',
        );
      },
    );

    it(
      'rejects mandatory channels that are not allowed',
      () => {
        expect(
          () =>
            new NotificationChannelPolicy({
              allowedChannels: [
                'email',
              ],

              mandatoryChannels: [
                'push',
              ],
            }),
        ).toThrow(
          'Mandatory channel "push" must also be allowed',
        );
      },
    );

    it(
      'rejects a self-exclusive channel configuration',
      () => {
        expect(
          () =>
            new NotificationChannelPolicy({
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
  },
);