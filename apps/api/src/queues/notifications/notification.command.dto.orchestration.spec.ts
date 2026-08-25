import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  BadRequestException,
} from '@nestjs/common';

import {
  parseCreateNotificationHttpRequest,
} from './notification.command.dto.js';

describe(
  'parseCreateNotificationHttpRequest - multi-channel orchestration',
  () => {
    const base =
      {
        notificationId:
          'phase-3-2-15-http-001',

        userId:
          'user-001',

        recipient: {
          userId:
            'user-001',

          email:
            'user-001@example.com',

          deviceTokens: [
            'device-a',
          ],
        },

        idempotencyKey:
          'phase-3-2-15-http-001',

        content: {
          body:
            'Multi-channel notification.',
        },
      };

    it(
      'accepts channels array',
      () => {
        const result =
          parseCreateNotificationHttpRequest({
            ...base,

            channels: [
              'email',
              'push',
              'in-app',
            ],
          });

        expect(
          result.channels,
        ).toEqual([
          'email',
          'push',
          'in-app',
        ]);

        expect(
          result.channel,
        ).toBeUndefined();
      },
    );

    it(
      'rejects duplicate channels',
      () => {
        expect(
          () =>
            parseCreateNotificationHttpRequest({
              ...base,

              channels: [
                'email',
                'email',
              ],
            }),
        ).toThrow(
          new BadRequestException(
            'channels must not contain duplicates.',
          ),
        );
      },
    );

    it(
      'rejects an empty channels array',
      () => {
        expect(
          () =>
            parseCreateNotificationHttpRequest({
              ...base,

              channels: [],
            }),
        ).toThrow(
          'channels must be a non-empty array.',
        );
      },
    );

    it(
      'rejects simultaneous channel and channels',
      () => {
        expect(
          () =>
            parseCreateNotificationHttpRequest({
              ...base,

              channel:
                'email',

              channels: [
                'push',
              ],
            }),
        ).toThrow(
          'Exactly one of channel or channels must be provided.',
        );
      },
    );

    it(
      'preserves the legacy single-channel contract',
      () => {
        const result =
          parseCreateNotificationHttpRequest({
            ...base,

            channel:
              'email',
          });

        expect(
          result.channel,
        ).toBe(
          'email',
        );

        expect(
          result.channels,
        ).toBeUndefined();
      },
    );
  },
);
