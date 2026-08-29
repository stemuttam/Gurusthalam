import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  NotificationAggregationBuilder,
} from './notification-aggregation.builder.js';

import type {
  NotificationFallbackMetadata,
  NotificationJobData,
  NotificationJsonValue,
  NotificationRecipient,
  NotificationTemplateSnapshot,
} from './notification.types.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationSourceEvent,
} from './notification-aggregation.source-event.resolver.js';

function createGroup(
  overrides: Partial<NotificationAggregationRepositoryGroup> = {},
): NotificationAggregationRepositoryGroup {
  return {
    aggregationId:
      'aggregation-test-001',

    groupKey:
      'user-001|email|course|course-update|en-IN',

    userId:
      'user-001',

    channel:
      'email',

    category:
      'course',

    aggregationKey:
      'course-update',

    locale:
      'en-IN',

    windowStart:
      new Date(
        '2026-08-29T10:00:00.000Z',
      ),

    windowEnd:
      new Date(
        '2026-08-29T10:05:00.000Z',
      ),

    itemCount:
      2,

    status:
      'OPEN',

    createdAt:
      new Date(
        '2026-08-29T10:00:00.000Z',
      ),

    updatedAt:
      new Date(
        '2026-08-29T10:02:00.000Z',
      ),

    ...overrides,
  };
}

function createItem(
  sourceEventId: string,
  overrides: Partial<NotificationAggregationRepositoryItem> = {},
): NotificationAggregationRepositoryItem {
  return {
    aggregationId:
      'aggregation-test-001',

    itemId:
      `item-${sourceEventId}`,

    sourceEventId,

    occurredAt:
      new Date(
        '2026-08-29T10:00:00.000Z',
      ),

    orderingKey:
      `01756562000000|${sourceEventId}`,

    createdAt:
      new Date(
        '2026-08-29T10:00:00.000Z',
      ),

    ...overrides,
  };
}

function createRecipient(
  overrides: Partial<NotificationRecipient> = {},
): NotificationRecipient {
  return {
    userId:
      'user-001',

    email:
      'student@example.com',

    deviceTokens: [
      'device-token-001',
    ],

    ...overrides,
  };
}

function createTemplateSnapshot(
  overrides: Partial<NotificationTemplateSnapshot> = {},
): NotificationTemplateSnapshot {
  return {
    templateId:
      'course-update',

    version:
      3,

    locale:
      'en-IN',

    body:
      'Course update available.',

    variables: [],

    ...overrides,
  };
}

function createFallbackMetadata(
  overrides: Partial<NotificationFallbackMetadata> = {},
): NotificationFallbackMetadata {
  return {
    planId:
      'fallback-plan-001',

    orchestrationId:
      'orchestration-001',

    primary:
      'email',

    fallbacks: [
      'in-app',
      'push',
    ],

    sequence: [
      'email',
      'in-app',
      'push',
    ],

    position:
      0,

    ...overrides,
  };
}

function createData(
  overrides: Partial<NotificationJobData> = {},
): NotificationJobData {
  return {
    notificationId:
      'notification-source-001',

    channel:
      'email',

    recipient:
      createRecipient(),

    body:
      'Course update available.',

    idempotencyKey:
      'notification-source-001',

    ...overrides,
  };
}

function createSourceEvent(
  sourceEventId: string,
  overrides: Partial<NotificationAggregationSourceEvent> = {},
): NotificationAggregationSourceEvent {
  return {
    sourceEventId,

    notificationId:
      sourceEventId,

    data:
      createData({
        notificationId:
          sourceEventId,

        idempotencyKey:
          `notification-${sourceEventId}`,
      }),

    ...overrides,
  };
}

function createInput(
  overrides: {
    group?: Partial<NotificationAggregationRepositoryGroup>;

    items?: readonly NotificationAggregationRepositoryItem[];

    sourceEvents?: readonly NotificationAggregationSourceEvent[];
  } = {},
) {
  const sourceEvents =
    overrides.sourceEvents ??
    [
      createSourceEvent(
        'source-001',
        {
          data:
            createData({
              notificationId:
                'source-001',

              body:
                'First course update.',

              idempotencyKey:
                'notification-source-001',
            }),
        },
      ),

      createSourceEvent(
        'source-002',
        {
          data:
            createData({
              notificationId:
                'source-002',

              body:
                'Second course update.',

              idempotencyKey:
                'notification-source-002',
            }),
        },
      ),
    ];

  const items =
    overrides.items ??
    [
      createItem(
        'source-001',
      ),

      createItem(
        'source-002',
        {
          itemId:
            'item-source-002',

          occurredAt:
            new Date(
              '2026-08-29T10:01:00.000Z',
            ),

          orderingKey:
            '01756562600000|source-002',
        },
      ),
    ];

  return {
    group:
      createGroup(
        overrides.group,
      ),

    items,

    sourceEvents,
  };
}

describe(
  'NotificationAggregationBuilder',
  () => {
    const builder =
      new NotificationAggregationBuilder();

    it(
      'builds NotificationJobData from a valid aggregation',
      () => {
        const result =
          builder.build(
            createInput(),
          );

        expect(
  result,
).toMatchObject({
  channel:
    'email',

  recipient: {
    userId:
      'user-001',

    email:
      'student@example.com',
  },

  body:
    'First course update.\nSecond course update.',

  idempotencyKey:
    'notification-aggregation:aggregation-test-001',
});

expect(
  result.notificationId,
).toMatch(
  /^aggregation-[0-9a-f]{8}$/,
);

        expect(
          result.notificationId,
        ).toMatch(
          /^aggregation-[0-9a-f]{8}$/,
        );
      },
    );

    it(
      'preserves deterministic source-event ordering when building the body',
      () => {
        const result =
          builder.build(
            createInput({
              items: [
                createItem(
                  'source-001',
                ),

                createItem(
                  'source-002',
                ),
              ],

              sourceEvents: [
                createSourceEvent(
                  'source-001',
                  {
                    data:
                      createData({
                        notificationId:
                          'source-001',

                        body:
                          'Alpha',
                      }),
                  },
                ),

                createSourceEvent(
                  'source-002',
                  {
                    data:
                      createData({
                        notificationId:
                          'source-002',

                        body:
                          'Beta',
                      }),
                  },
                ),
              ],
            }),
          );

        expect(
          result.body,
        ).toBe(
          'Alpha\nBeta',
        );
      },
    );

    it(
      'includes a consistent optional subject',
      () => {
        const result =
          builder.build(
            createInput({
              sourceEvents: [
                createSourceEvent(
                  'source-001',
                  {
                    data:
                      createData({
                        subject:
                          'Course updates',
                      }),
                  },
                ),

                createSourceEvent(
                  'source-002',
                  {
                    data:
                      createData({
                        subject:
                          'Course updates',
                      }),
                  },
                ),
              ],
            }),
          );

        expect(
          result.subject,
        ).toBe(
          'Course updates',
        );
      },
    );

    it(
      'includes a consistent optional title',
      () => {
        const result =
          builder.build(
            createInput({
              sourceEvents: [
                createSourceEvent(
                  'source-001',
                  {
                    data:
                      createData({
                        title:
                          'Course updates',
                      }),
                  },
                ),

                createSourceEvent(
                  'source-002',
                  {
                    data:
                      createData({
                        title:
                          'Course updates',
                      }),
                  },
                ),
              ],
            }),
          );

        expect(
          result.title,
        ).toBe(
          'Course updates',
        );
      },
    );

    it(
      'includes consistent template metadata',
      () => {
        const templateData:
          {
            [key: string]:
              NotificationJsonValue;
          } = {
            courseName:
              'Mathematics',

            lessonCount:
              5,
          };

        const templateSnapshot =
          createTemplateSnapshot();

        const fallbackMetadata =
          createFallbackMetadata();

        const result =
          builder.build(
            createInput({
              sourceEvents: [
                createSourceEvent(
                  'source-001',
                  {
                    data:
                      createData({
                        template:
                          'course-update',

                        templateVersion:
                          3,

                        templateLocale:
                          'en-IN',

                        templateData,

                        templateSnapshot,

                        fallbackMetadata,
                      }),
                  },
                ),

                createSourceEvent(
                  'source-002',
                  {
                    data:
                      createData({
                        template:
                          'course-update',

                        templateVersion:
                          3,

                        templateLocale:
                          'en-IN',

                        templateData,

                        templateSnapshot,

                        fallbackMetadata,
                      }),
                  },
                ),
              ],
            }),
          );

        expect(
          result.template,
        ).toBe(
          'course-update',
        );

        expect(
          result.templateVersion,
        ).toBe(
          3,
        );

        expect(
          result.templateLocale,
        ).toBe(
          'en-IN',
        );

        expect(
          result.templateData,
        ).toEqual(
          templateData,
        );

        expect(
          result.templateSnapshot,
        ).toEqual(
          templateSnapshot,
        );

        expect(
          result.fallbackMetadata,
        ).toEqual(
          fallbackMetadata,
        );
      },
    );

    it(
      'merges recipient device tokens without duplicates',
      () => {
        const result =
          builder.build(
            createInput({
              sourceEvents: [
                createSourceEvent(
                  'source-001',
                  {
                    data:
                      createData({
                        recipient:
                          createRecipient({
                            deviceTokens: [
                              'token-a',
                              'token-b',
                            ],
                          }),
                      }),
                  },
                ),

                createSourceEvent(
                  'source-002',
                  {
                    data:
                      createData({
                        recipient:
                          createRecipient({
                            deviceTokens: [
                              'token-b',
                              'token-c',
                            ],
                          }),
                      }),
                  },
                ),
              ],
            }),
          );

        expect(
          result.recipient.deviceTokens,
        ).toEqual([
          'token-a',
          'token-b',
          'token-c',
        ]);
      },
    );

    it(
      'rejects an empty aggregation',
      () => {
        expect(
          () =>
            builder.build({
              group:
                createGroup(),

              items: [],

              sourceEvents: [],
            }),
        ).toThrow(
          'contains no items',
        );
      },
    );

    it(
      'rejects a mismatch between item and source-event counts',
      () => {
        expect(
          () =>
            builder.build({
              group:
                createGroup(),

              items: [
                createItem(
                  'source-001',
                ),
              ],

              sourceEvents: [],
            }),
        ).toThrow(
          'has 1 items but 0 resolved source events',
        );
      },
    );

    it(
      'rejects source-event ordering that does not match aggregation items',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-002',
                  ),

                  createSourceEvent(
                    'source-001',
                  ),
                ],
              }),
            ),
        ).toThrow(
          'Resolved source event ordering does not match aggregation item ordering',
        );
      },
    );

    it(
      'rejects a source event from a different channel',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          channel:
                            'push',
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                  ),
                ],
              }),
            ),
        ).toThrow(
          'has channel "push"',
        );
      },
    );

    it(
      'rejects a source event belonging to a different user',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          recipient:
                            createRecipient({
                              userId:
                                'different-user',
                            }),
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                  ),
                ],
              }),
            ),
        ).toThrow(
          'belongs to user "different-user"',
        );
      },
    );

    it(
      'rejects inconsistent optional subject values',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          subject:
                            'Subject A',
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                    {
                      data:
                        createData({
                          subject:
                            'Subject B',
                        }),
                    },
                  ),
                ],
              }),
            ),
        ).toThrow(
          'inconsistent subject values',
        );
      },
    );

    it(
      'rejects inconsistent templateVersion values',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          templateVersion:
                            1,
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                    {
                      data:
                        createData({
                          templateVersion:
                            2,
                        }),
                    },
                  ),
                ],
              }),
            ),
        ).toThrow(
          'inconsistent templateVersion values',
        );
      },
    );

    it(
      'rejects inconsistent templateData values',
      () => {
        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          templateData:
                            {
                              value:
                                1,
                            },
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                    {
                      data:
                        createData({
                          templateData:
                            {
                              value:
                                2,
                            },
                        }),
                    },
                  ),
                ],
              }),
            ),
        ).toThrow(
          'inconsistent templateData values',
        );
      },
    );

    it(
      'rejects inconsistent template snapshots',
      () => {
        const snapshotA =
          createTemplateSnapshot({
            version:
              1,
          });

        const snapshotB =
          createTemplateSnapshot({
            version:
              2,
          });

        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          templateSnapshot:
                            snapshotA,
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                    {
                      data:
                        createData({
                          templateSnapshot:
                            snapshotB,
                        }),
                    },
                  ),
                ],
              }),
            ),
        ).toThrow(
          'inconsistent templateSnapshot values',
        );
      },
    );

    it(
      'rejects inconsistent fallback metadata',
      () => {
        const metadataA =
          createFallbackMetadata({
            position:
              0,
          });

        const metadataB =
          createFallbackMetadata({
            position:
              1,
          });

        expect(
          () =>
            builder.build(
              createInput({
                sourceEvents: [
                  createSourceEvent(
                    'source-001',
                    {
                      data:
                        createData({
                          fallbackMetadata:
                            metadataA,
                        }),
                    },
                  ),

                  createSourceEvent(
                    'source-002',
                    {
                      data:
                        createData({
                          fallbackMetadata:
                            metadataB,
                        }),
                    },
                  ),
                ],
              }),
            ),
        ).toThrow(
          'inconsistent fallbackMetadata values',
        );
      },
    );

    it(
      'does not mutate the source NotificationJobData objects',
      () => {
        const firstData =
          createData({
            subject:
              'Original subject',
          });

        const secondData =
          createData({
            subject:
              'Original subject',
          });

        const firstSnapshot =
          structuredClone(
            firstData,
          );

        const secondSnapshot =
          structuredClone(
            secondData,
          );

        builder.build(
          createInput({
            sourceEvents: [
              createSourceEvent(
                'source-001',
                {
                  data:
                    firstData,
                },
              ),

              createSourceEvent(
                'source-002',
                {
                  data:
                    secondData,
                },
              ),
            ],
          }),
        );

        expect(
          firstData,
        ).toEqual(
          firstSnapshot,
        );

        expect(
          secondData,
        ).toEqual(
          secondSnapshot,
        );
      },
    );

    it(
      'produces the same notification ID for the same aggregation ID',
      () => {
        const input =
          createInput();

        const first =
          builder.build(
            input,
          );

        const second =
          builder.build(
            input,
          );

        expect(
          first.notificationId,
        ).toBe(
          second.notificationId,
        );
      },
    );

    it(
      'produces the same idempotency key for the same aggregation ID',
      () => {
        const input =
          createInput();

        const first =
          builder.build(
            input,
          );

        const second =
          builder.build(
            input,
          );

        expect(
          first.idempotencyKey,
        ).toBe(
          second.idempotencyKey,
        );
      },
    );
  },
);