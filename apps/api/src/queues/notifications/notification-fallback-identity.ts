import {
  createHash,
} from 'node:crypto';

import type {
  NotificationChannelFallbackPlan,
} from './notification.channel-fallback-policy.js';

export interface NotificationFallbackMetadata {
  readonly planId:
    string;

  readonly orchestrationId:
    string;

  readonly primary:
    NotificationChannelFallbackPlan['primary'];

  readonly fallbacks:
    NotificationChannelFallbackPlan['fallbacks'];

  readonly sequence:
    NotificationChannelFallbackPlan['sequence'];

  readonly position:
    number;
}

interface NotificationFallbackIdentityInput {
  readonly orchestrationId:
    string;

  readonly plan:
    NotificationChannelFallbackPlan;
}

function normalizeIdentityInput(
  input:
    NotificationFallbackIdentityInput,
):
  string {
  return JSON.stringify({
    orchestrationId:
      input.orchestrationId,

    primary:
      input.plan.primary,

    fallbacks:
      [
        ...input.plan.fallbacks,
      ],

    sequence:
      [
        ...input.plan.sequence,
      ],
  });
}

export function createNotificationFallbackPlanId(
  input:
    NotificationFallbackIdentityInput,
):
  string {
  return createHash(
    'sha256',
  )
    .update(
      normalizeIdentityInput(
        input,
      ),
    )
    .digest(
      'hex',
    );
}

export function createNotificationFallbackMetadata(
  orchestrationId:
    string,

  plan:
    NotificationChannelFallbackPlan,

  channel:
    NotificationChannelFallbackPlan['sequence'][number],
):
  NotificationFallbackMetadata {
  const position =
    plan.sequence.indexOf(
      channel,
    );

  if (
    position <
    0
  ) {
    throw new Error(
      `Channel "${channel}" is not part of fallback sequence for primary channel "${plan.primary}".`,
    );
  }

  return {
    planId:
      createNotificationFallbackPlanId({
        orchestrationId,

        plan,
      }),

    orchestrationId,

    primary:
      plan.primary,

    fallbacks:
      [
        ...plan.fallbacks,
      ],

    sequence:
      [
        ...plan.sequence,
      ],

    position,
  };
}