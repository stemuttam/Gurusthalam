import {
  describe,
  expect,
  it,
} from 'vitest';

const apiBaseUrl =
  process.env.API_RUNTIME_BASE_URL?.replace(
    /\/+$/,
    '',
  ) ??
  'http://127.0.0.1:3000/api';

const internalApiKey =
  process.env.INTERNAL_API_KEY;

describe(
  'Notification reconciliation - real HTTP runtime',
  () => {
    it(
      'rejects unauthenticated reconciliation audit',
      async () => {
        const response =
          await fetch(
            `${apiBaseUrl}/internal/notification-reconciliation`,
            {
              method:
                'GET',
            },
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'allows authenticated reconciliation audit',
      async () => {
        if (
          !internalApiKey
        ) {
          throw new Error(
            'INTERNAL_API_KEY is required.',
          );
        }

        const response =
          await fetch(
            `${apiBaseUrl}/internal/notification-reconciliation?staleAfterSeconds=300&limit=25`,
            {
              method:
                'GET',

              headers: {
                'x-internal-api-key':
                  internalApiKey,
              },
            },
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        const body =
          await response.json();

        expect(
          body,
        ).toMatchObject({
          scannedDeliveries:
            expect.any(
              Number,
            ),

          staleProcessingDeliveries:
            expect.any(
              Number,
            ),

          anomalies:
            expect.any(
              Array,
            ),
        });
      },
    );

    it(
      'allows authenticated stale-delivery recovery',
      async () => {
        if (
          !internalApiKey
        ) {
          throw new Error(
            'INTERNAL_API_KEY is required.',
          );
        }

        const response =
          await fetch(
            `${apiBaseUrl}/internal/notification-reconciliation/recover-stale?staleAfterSeconds=300&limit=25`,
            {
              method:
                'POST',

              headers: {
                'x-internal-api-key':
                  internalApiKey,
              },
            },
          );

        expect(
          response.status,
        ).toBe(
          201,
        );

        const body =
          await response.json();

        expect(
          body,
        ).toMatchObject({
          scanned:
            expect.any(
              Number,
            ),

          recovered:
            expect.any(
              Number,
            ),

          cutoff:
            expect.any(
              String,
            ),

          deliveryIds:
            expect.any(
              Array,
            ),
        });
      },
    );
  },
);