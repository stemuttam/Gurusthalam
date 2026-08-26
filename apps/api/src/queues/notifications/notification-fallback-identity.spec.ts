import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createNotificationFallbackMetadata,
  createNotificationFallbackPlanId,
} from './notification-fallback-identity.js';

import type {
  NotificationChannelFallbackPlan,
} from './notification.channel-fallback-policy.js';

describe(
  'notification fallback identity',
  () => {
    const createPlan =
      (
        primary:
          'email' |
          'push' |
          'in-app',

        fallbacks:
          readonly (
            'email' |
            'push' |
            'in-app'
          )[],
      ):
        NotificationChannelFallbackPlan => ({
        primary,

        fallbacks,

        sequence: [
          primary,
          ...fallbacks,
        ],
      });

    it(
      'creates a deterministic plan identity',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
              'in-app',
            ],
          );

        const first =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan,
          });

        const second =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan,
          });

        expect(
          first,
        ).toBe(
          second,
        );

        expect(
          first,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );
      },
    );

    it(
      'changes the identity when the fallback sequence changes',
      () => {
        const firstPlan =
          createPlan(
            'email',
            [
              'push',
            ],
          );

        const secondPlan =
          createPlan(
            'email',
            [
              'in-app',
            ],
          );

        const first =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan:
              firstPlan,
          });

        const second =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan:
              secondPlan,
          });

        expect(
          first,
        ).not.toBe(
          second,
        );
      },
    );

    it(
      'changes the identity when the orchestration identity changes',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
            ],
          );

        const first =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan,
          });

        const second =
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-002',

            plan,
          });

        expect(
          first,
        ).not.toBe(
          second,
        );
      },
    );

    it(
      'creates metadata for the primary position',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
              'in-app',
            ],
          );

        const metadata =
          createNotificationFallbackMetadata(
            'orchestration-001',

            plan,

            'email',
          );

        expect(
          metadata.primary,
        ).toBe(
          'email',
        );

        expect(
          metadata.fallbacks,
        ).toEqual([
          'push',
          'in-app',
        ]);

        expect(
          metadata.sequence,
        ).toEqual([
          'email',
          'push',
          'in-app',
        ]);

        expect(
          metadata.position,
        ).toBe(
          0,
        );

        expect(
          metadata.orchestrationId,
        ).toBe(
          'orchestration-001',
        );

        expect(
          metadata.planId,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );
      },
    );

    it(
      'creates metadata for a fallback position',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
              'in-app',
            ],
          );

        const metadata =
          createNotificationFallbackMetadata(
            'orchestration-001',

            plan,

            'in-app',
          );

        expect(
          metadata.position,
        ).toBe(
          2,
        );

        expect(
          metadata.planId,
        ).toBe(
          createNotificationFallbackPlanId({
            orchestrationId:
              'orchestration-001',

            plan,
          }),
        );
      },
    );

    it(
      'rejects a channel outside the fallback sequence',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
            ],
          );

        expect(
          () =>
            createNotificationFallbackMetadata(
              'orchestration-001',

              plan,

              'in-app',
            ),
        ).toThrow(
          'Channel "in-app" is not part of fallback sequence for primary channel "email".',
        );
      },
    );

    it(
      'does not mutate fallback plan arrays',
      () => {
        const plan =
          createPlan(
            'email',
            [
              'push',
              'in-app',
            ],
          );

        const metadata =
          createNotificationFallbackMetadata(
            'orchestration-001',

            plan,

            'push',
          );

        expect(
          metadata.fallbacks,
        ).not.toBe(
          plan.fallbacks,
        );

        expect(
          metadata.sequence,
        ).not.toBe(
          plan.sequence,
        );
      },
    );
  },
);