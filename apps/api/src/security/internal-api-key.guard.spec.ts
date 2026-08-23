import {
  UnauthorizedException,
} from '@nestjs/common';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  InternalApiKeyGuard,
} from './internal-api-key.guard.js';

type MockRequest = {
  header: (
    name: string,
  ) => string | undefined;
};

function createContext(
  headers: Record<
    string,
    string | undefined
  >,
) {
  const request: MockRequest = {
    header:
      vi.fn(
        (
          name: string,
        ) =>
          headers[name],
      ),
  };

  return {
    switchToHttp:
      () => ({
        getRequest:
          () =>
            request,
      }),
  } as never;
}

describe(
  'InternalApiKeyGuard',
  () => {
    const testKey =
      'phase-3-2-10-test-internal-key';

    let originalKey:
      string | undefined;

    beforeEach(
      () => {
        originalKey =
          process.env.INTERNAL_API_KEY;

        process.env.INTERNAL_API_KEY =
          testKey;
      },
    );

    afterEach(
      () => {
        if (
          originalKey ===
          undefined
        ) {
          delete process.env
            .INTERNAL_API_KEY;
        } else {
          process.env.INTERNAL_API_KEY =
            originalKey;
        }
      },
    );

    it(
      'allows the configured internal API key',
      () => {
        const guard =
          new InternalApiKeyGuard();

        const result =
          guard.canActivate(
            createContext({
              'x-internal-api-key':
                testKey,
            }),
          );

        expect(
          result,
        ).toBe(
          true,
        );
      },
    );

    it(
      'rejects a missing request key',
      () => {
        const guard =
          new InternalApiKeyGuard();

        expect(
          () =>
            guard.canActivate(
              createContext({}),
            ),
        ).toThrow(
          UnauthorizedException,
        );
      },
    );

    it(
      'rejects an incorrect request key',
      () => {
        const guard =
          new InternalApiKeyGuard();

        expect(
          () =>
            guard.canActivate(
              createContext({
                'x-internal-api-key':
                  'wrong-key',
              }),
            ),
        ).toThrow(
          UnauthorizedException,
        );
      },
    );

    it(
      'fails closed when INTERNAL_API_KEY is not configured',
      () => {
        delete process.env
          .INTERNAL_API_KEY;

        const guard =
          new InternalApiKeyGuard();

        expect(
          () =>
            guard.canActivate(
              createContext({
                'x-internal-api-key':
                  testKey,
              }),
            ),
        ).toThrow(
          UnauthorizedException,
        );
      },
    );

    it(
      'rejects keys with different lengths',
      () => {
        const guard =
          new InternalApiKeyGuard();

        expect(
          () =>
            guard.canActivate(
              createContext({
                'x-internal-api-key':
                  'short',
              }),
            ),
        ).toThrow(
          UnauthorizedException,
        );
      },
    );
  },
);