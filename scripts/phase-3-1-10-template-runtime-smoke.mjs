import assert from 'node:assert/strict';

import {
  Console,
} from 'node:console';

import process from 'node:process';

const output =
  new Console(
    process.stdout,
    process.stderr,
  );

const API_BASE_URL =
  process.env.API_BASE_URL ??
  'http://127.0.0.1:3000';

const POLL_INTERVAL_MS =
  1000;

const POLL_TIMEOUT_MS =
  30000;

const RUN_ID =
  `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const TEMPLATE_ID =
  `phase-3-1-10-smoke-${RUN_ID}`;

const NOTIFICATION_ID =
  `phase-3-1-10-notification-${RUN_ID}`;

const IDEMPOTENCY_KEY =
  `phase-3-1-10-idempotency-${RUN_ID}`;

const USER_ID =
  `phase-3-1-10-user-${RUN_ID}`;

const EMAIL =
  `phase-3-1-10-${RUN_ID}@gurusthalam.local`;

function logStep(
  message,
) {
  output.log(
    `\n[Phase 3.1.10] ${message}`,
  );
}

async function request(
  path,
  options = {},
) {
  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          'Content-Type':
            'application/json',

          ...(options.headers ??
            {}),
        },
      },
    );

  const text =
    await response.text();

  let body;

  if (
    text.length >
    0
  ) {
    try {
      body =
        JSON.parse(
          text,
        );
    } catch {
      body =
        text;
    }
  }

  if (
    !response.ok
  ) {
    const error =
      new Error(
        `HTTP ${response.status} ${response.statusText} for ${path}`,
      );

    error.responseBody =
      body;

    throw error;
  }

  return body;
}

function sleep(
  milliseconds,
) {
  return new Promise(
    (
      resolve,
    ) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function waitForNotificationStatus(
  notificationId,
  expectedStatus,
) {
  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    POLL_TIMEOUT_MS
  ) {
    const result =
      await request(
        `/api/internal/notifications/${encodeURIComponent(
          notificationId,
        )}`,
      );

    if (
      result?.found ===
      true
    ) {
      const status =
        result.notification?.status;

      output.log(
        `  notification status: ${status}`,
      );

      if (
        status ===
        expectedStatus
      ) {
        return result.notification;
      }

      if (
        status ===
          'FAILED' ||
        status ===
          'DEAD_LETTER'
      ) {
        throw new Error(
          `Notification entered unexpected terminal status ${status}.`,
        );
      }
    }

    await sleep(
      POLL_INTERVAL_MS,
    );
  }

  throw new Error(
    `Timed out waiting for notification ${notificationId} to reach ${expectedStatus}.`,
  );
}

async function run() {
  output.log(
    '============================================================',
  );

  output.log(
    'Gurusthalam Phase 3.1.10 Template Runtime Smoke Test',
  );

  output.log(
    '============================================================',
  );

  output.log(
    `API: ${API_BASE_URL}`,
  );

  output.log(
    `Template: ${TEMPLATE_ID}`,
  );

  output.log(
    `Notification: ${NOTIFICATION_ID}`,
  );

  /*
   * -----------------------------------------------------------
   * 1. API availability
   * -----------------------------------------------------------
   */
  logStep(
    'Checking API availability...',
  );

  await request(
    '/api/internal/notification-templates/__phase_3_1_10_nonexistent__',
  ).catch(
    (error) => {
      /*
       * A 404 is acceptable here because the endpoint exists.
       * A network error means the API is not running.
       */
      if (
        error?.responseBody !==
        undefined
      ) {
        return;
      }

      throw error;
    },
  );

  output.log(
    '  API reachable.',
  );

  /*
   * -----------------------------------------------------------
   * 2. Create template
   * -----------------------------------------------------------
   */
  logStep(
    'Creating template...',
  );

  const createdTemplate =
    await request(
      '/api/internal/notification-templates',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            templateId:
              TEMPLATE_ID,

            name:
              'Phase 3.1.10 Smoke Template',

            description:
              'Automated template runtime smoke test.',

            channel:
              'EMAIL',

            category:
              'COURSE',

            locale:
              'en-IN',

            createdBy:
              'phase-3-1-10-smoke',
          }),
      },
    );

  assert.equal(
    createdTemplate.templateId,
    TEMPLATE_ID,
  );

  assert.equal(
    createdTemplate.status,
    'DRAFT',
  );

  output.log(
    '  Template created.',
  );

  /*
   * -----------------------------------------------------------
   * 3. Create version
   * -----------------------------------------------------------
   */
  logStep(
    'Creating template version 1...',
  );

  const createdVersion =
    await request(
      `/api/internal/notification-templates/${encodeURIComponent(
        TEMPLATE_ID,
      )}/versions`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            version:
              1,

            subject:
              'Welcome {{user.firstName}}',

            title:
              'Welcome to {{course.title}}',

            body:
              'Hello {{user.firstName}}, welcome to {{course.title}}.',

            variables: [
              {
                path:
                  'user.firstName',

                required:
                  true,

                type:
                  'string',
              },

              {
                path:
                  'course.title',

                required:
                  true,

                type:
                  'string',
              },
            ],

            createdBy:
              'phase-3-1-10-smoke',
          }),
      },
    );

  assert.equal(
    createdVersion.version,
    1,
  );

  assert.equal(
    createdVersion.status,
    'DRAFT',
  );

  output.log(
    '  Version 1 created.',
  );

  /*
   * -----------------------------------------------------------
   * 4. Structural validation
   * -----------------------------------------------------------
   */
  logStep(
    'Running structural validation...',
  );

  const validation =
    await request(
      `/api/internal/notification-templates/${encodeURIComponent(
        TEMPLATE_ID,
      )}/validate`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            version:
              1,
          }),
      },
    );

  assert.equal(
    validation.valid,
    true,
  );

  assert.equal(
    validation.errors.length,
    0,
  );

  output.log(
    '  Structural validation passed.',
  );

  /*
   * -----------------------------------------------------------
   * 5. Preview with runtime data
   * -----------------------------------------------------------
   */
  logStep(
    'Rendering template preview...',
  );

  const preview =
    await request(
      `/api/internal/notification-templates/${encodeURIComponent(
        TEMPLATE_ID,
      )}/preview`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            version:
              1,

            data: {
              user: {
                firstName:
                  'SmokeTest',
              },

              course: {
                title:
                  'Advanced JavaScript',
              },
            },

            locale:
              'en-IN',
          }),
      },
    );

  assert.equal(
    preview.templateId,
    TEMPLATE_ID,
  );

  assert.equal(
    preview.version,
    1,
  );

  assert.equal(
    preview.rendered.subject,
    'Welcome SmokeTest',
  );

  assert.equal(
    preview.rendered.title,
    'Welcome to Advanced JavaScript',
  );

  assert.equal(
    preview.rendered.body,
    'Hello SmokeTest, welcome to Advanced JavaScript.',
  );

  output.log(
    '  Preview rendered correctly.',
  );

  /*
   * -----------------------------------------------------------
   * 6. Negative runtime validation
   * -----------------------------------------------------------
   */
  logStep(
    'Testing missing required runtime data...',
  );

  try {
    await request(
      `/api/internal/notification-templates/${encodeURIComponent(
        TEMPLATE_ID,
      )}/preview`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            version:
              1,

            data: {
              user: {},

              course: {},
            },
          }),
      },
    );

    throw new Error(
      'Expected preview with missing required variables to fail.',
    );
  } catch (
    error
  ) {
    if (
      error?.responseBody ===
      undefined
    ) {
      throw error;
    }

    output.log(
      '  Missing-variable validation correctly rejected the request.',
    );
  }

  /*
   * -----------------------------------------------------------
   * 7. Publish
   * -----------------------------------------------------------
   */
  logStep(
    'Publishing version 1...',
  );

  const publishedTemplate =
    await request(
      `/api/internal/notification-templates/${encodeURIComponent(
        TEMPLATE_ID,
      )}/versions/1/publish`,
      {
        method:
          'POST',
      },
    );

  assert.equal(
    publishedTemplate.templateId,
    TEMPLATE_ID,
  );

  assert.equal(
    publishedTemplate.status,
    'PUBLISHED',
  );

  assert.equal(
    publishedTemplate.currentVersion,
    1,
  );

  const publishedVersion =
    publishedTemplate.versions.find(
      (
        version,
      ) =>
        version.version ===
        1,
    );

  assert.ok(
    publishedVersion,
  );

  assert.equal(
    publishedVersion.status,
    'PUBLISHED',
  );

  assert.ok(
    publishedVersion.publishedAt,
  );

  output.log(
    '  Template published.',
  );

  /*
   * -----------------------------------------------------------
   * 8. Enqueue template-backed notification
   * -----------------------------------------------------------
   */
  logStep(
    'Enqueuing template-backed notification...',
  );

  const enqueueResult =
    await request(
      '/api/internal/notifications/smoke',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            notificationId:
              NOTIFICATION_ID,

            userId:
              USER_ID,

            email:
              EMAIL,

            templateId:
              TEMPLATE_ID,

            templateData: {
              user: {
                firstName:
                  'SmokeTest',
              },

              course: {
                title:
                  'Advanced JavaScript',
              },
            },

            locale:
              'en-IN',

            idempotencyKey:
              IDEMPOTENCY_KEY,
          }),
      },
    );

  assert.equal(
    enqueueResult.notificationId,
    NOTIFICATION_ID,
  );

  assert.equal(
    enqueueResult.status,
    'QUEUED',
  );

  assert.ok(
    enqueueResult.outboxEventId,
  );

  output.log(
    `  Notification queued. Outbox: ${enqueueResult.outboxEventId}`,
  );

  /*
   * -----------------------------------------------------------
   * 9. Verify rendered content was persisted
   * -----------------------------------------------------------
   */
  logStep(
    'Verifying persisted rendered notification...',
  );

  const notificationBeforeDelivery =
    await request(
      `/api/internal/notifications/${encodeURIComponent(
        NOTIFICATION_ID,
      )}`,
    );

  assert.equal(
    notificationBeforeDelivery.found,
    true,
  );

  assert.equal(
    notificationBeforeDelivery.notification.template,
    TEMPLATE_ID,
  );

  assert.equal(
    notificationBeforeDelivery.notification.subject,
    'Welcome SmokeTest',
  );

  assert.equal(
    notificationBeforeDelivery.notification.title,
    'Welcome to Advanced JavaScript',
  );

  assert.equal(
    notificationBeforeDelivery.notification.body,
    'Hello SmokeTest, welcome to Advanced JavaScript.',
  );

  output.log(
    '  Rendered content persisted correctly.',
  );

  /*
   * -----------------------------------------------------------
   * 10. Wait for worker delivery
   * -----------------------------------------------------------
   */
  logStep(
    'Waiting for worker delivery...',
  );

  const deliveredNotification =
    await waitForNotificationStatus(
      NOTIFICATION_ID,
      'SENT',
    );

  assert.equal(
    deliveredNotification.template,
    TEMPLATE_ID,
  );

  assert.equal(
    deliveredNotification.subject,
    'Welcome SmokeTest',
  );

  assert.equal(
    deliveredNotification.title,
    'Welcome to Advanced JavaScript',
  );

  assert.equal(
    deliveredNotification.body,
    'Hello SmokeTest, welcome to Advanced JavaScript.',
  );

  assert.ok(
    deliveredNotification.provider,
  );

  assert.ok(
    deliveredNotification.providerMessageId,
  );

  output.log(
    '  Worker delivered the notification successfully.',
  );

  /*
   * -----------------------------------------------------------
   * 11. Troubleshooting / delivery persistence
   * -----------------------------------------------------------
   */
  logStep(
    'Verifying delivery persistence...',
  );

  const troubleshooting =
    await request(
      `/api/internal/notifications/${encodeURIComponent(
        NOTIFICATION_ID,
      )}/troubleshooting`,
    );

  assert.equal(
    troubleshooting.notification.status,
    'SENT',
  );

  assert.equal(
    troubleshooting.notification.subject,
    'Welcome SmokeTest',
  );

  assert.equal(
    troubleshooting.notification.title,
    'Welcome to Advanced JavaScript',
  );

  assert.equal(
    troubleshooting.notification.body,
    'Hello SmokeTest, welcome to Advanced JavaScript.',
  );

  assert.ok(
    Array.isArray(
      troubleshooting.deliveries,
    ),
  );

  assert.ok(
    troubleshooting.deliveries.length >=
      1,
  );

  const successfulDelivery =
    troubleshooting.deliveries.find(
      (
        delivery,
      ) =>
        delivery.status ===
        'SENT',
    );

  assert.ok(
    successfulDelivery,
  );

  assert.ok(
    successfulDelivery.providerMessageId,
  );

  /*
   * -----------------------------------------------------------
   * 12. Idempotency
   * -----------------------------------------------------------
   */
  logStep(
    'Verifying notification idempotency...',
  );

  const duplicateEnqueue =
    await request(
      '/api/internal/notifications/smoke',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            notificationId:
              NOTIFICATION_ID,

            userId:
              USER_ID,

            email:
              EMAIL,

            templateId:
              TEMPLATE_ID,

            templateData: {
              user: {
                firstName:
                  'SmokeTest',
              },

              course: {
                title:
                  'Advanced JavaScript',
              },
            },

            locale:
              'en-IN',

            idempotencyKey:
              IDEMPOTENCY_KEY,
          }),
      },
    );

  assert.equal(
    duplicateEnqueue.notificationId,
    NOTIFICATION_ID,
  );

  assert.equal(
    duplicateEnqueue.outboxEventId,
    enqueueResult.outboxEventId,
  );

  output.log(
    '  Notification idempotency passed.',
  );

  /*
   * -----------------------------------------------------------
   * 13. Finish
   * -----------------------------------------------------------
   */
  output.log(
    '\n============================================================',
  );

  output.log(
    'PHASE 3.1.10 SMOKE TEST: PASSED',
  );

  output.log(
    '============================================================',
  );

  output.log(
    `Template:     ${TEMPLATE_ID}`,
  );

  output.log(
    `Notification: ${NOTIFICATION_ID}`,
  );

  output.log(
    `Outbox:       ${enqueueResult.outboxEventId}`,
  );

  output.log(
    'Template rendering:      PASS',
  );

  output.log(
    'Structural validation:   PASS',
  );

  output.log(
    'Runtime validation:      PASS',
  );

  output.log(
    'Publish lifecycle:       PASS',
  );

  output.log(
    'Notification persistence:PASS',
  );

  output.log(
    'Worker delivery:         PASS',
  );

  output.log(
    'Delivery persistence:    PASS',
  );

  output.log(
    'Idempotency:             PASS',
  );

  output.log(
    '============================================================',
  );
}

run().catch(
  (
    error,
  ) => {
    output.error(
      '\n============================================================',
    );

    output.error(
      'PHASE 3.1.10 SMOKE TEST: FAILED',
    );

    output.log(
      '============================================================',
    );

    output.log(
      error,
    );

    if (
      error?.responseBody !==
      undefined
    ) {
      output.error(
        '\nAPI response body:',
      );

      output.log(
        JSON.stringify(
          error.responseBody,
          null,
          2,
        ),
      );
    }

    process.exit(
      1,
    );
  },
);