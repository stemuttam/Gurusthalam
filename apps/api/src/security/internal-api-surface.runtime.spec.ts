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

describe(
  'Internal API security surface - real HTTP runtime',
  () => {
    async function request(
      path:
        string,

      method:
        'GET' | 'POST',
    ) {
      const response =
        await fetch(
          `${apiBaseUrl}${path}`,
          {
            method,
          },
        );

      const text =
        await response.text();

      let body:
        unknown = null;

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

      return {
        status:
          response.status,

        body,
      };
    }

    it(
      'rejects unauthenticated BullMQ queue inspection',
      async () => {
        const response =
          await request(
            '/internal/queues/notifications',
            'GET',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated system queue mutation',
      async () => {
        const response =
          await request(
            '/internal/queues/system-smoke',
            'POST',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated notification metrics',
      async () => {
        const response =
          await request(
            '/internal/notifications/metrics',
            'GET',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated notification troubleshooting',
      async () => {
        const response =
          await request(
            '/internal/notifications/security-test/troubleshooting',
            'GET',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated notification smoke endpoint',
      async () => {
        const response =
          await request(
            '/internal/notifications/smoke',
            'POST',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated outbox administration',
      async () => {
        const response =
          await request(
            '/internal/outbox/summary',
            'GET',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'rejects unauthenticated template administration',
      async () => {
        const response =
          await request(
            '/internal/notification-templates/example',
            'GET',
          );

        expect(
          response.status,
        ).toBe(
          401,
        );
      },
    );

    it(
      'does not require the internal key for the public notification command endpoint',
      async () => {
        const response =
          await request(
            '/notifications',
            'POST',
          );

        /*
         * The endpoint may reject the empty body with 400, but it
         * must NOT reject it with 401. This proves the public
         * command endpoint was not accidentally protected.
         */
        expect(
          response.status,
        ).not.toBe(
          401,
        );
      },
    );
  },
);