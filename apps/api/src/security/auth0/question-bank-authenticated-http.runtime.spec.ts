
import { describe, expect, it } from 'vitest';

const API_RUNTIME_BASE_URL =
  process.env.API_RUNTIME_BASE_URL ??
  'http://127.0.0.1:3000/api';

const QUESTION_ID =
  process.env.QUESTION_BANK_HTTP_TEST_QUESTION_ID ??
  '3eebe583-27e0-48f3-aef0-b20390ae683c';

const NEW_OWNER_TOKEN =
  process.env.QUESTION_BANK_NEW_OWNER_TOKEN;

const FORMER_OWNER_TOKEN =
  process.env.QUESTION_BANK_FORMER_OWNER_TOKEN;

const INSUFFICIENT_SCOPE_TOKEN =
  process.env.QUESTION_BANK_INSUFFICIENT_SCOPE_TOKEN;

const NO_MANAGE_SCOPE_TOKEN =
  process.env.QUESTION_BANK_NO_MANAGE_SCOPE_TOKEN;

const UNPROVISIONED_TOKEN =
  process.env.QUESTION_BANK_UNPROVISIONED_TOKEN;

const TEST_RECIPIENT_ID =
  process.env.QUESTION_BANK_HTTP_TEST_RECIPIENT_ID ??
  'a4e00000-514e-4000-8000-000000000002';

type RequestHeaders = Record<string, string>;

function getConfiguredToken(
  token: string | undefined,
  label: string,
): string {
  if (token === undefined || token.trim().length === 0) {
    throw new Error(
      `Required test token is not configured: ${label}`,
    );
  }

  return token;
}

function authorizationHeaders(
  token: string,
): RequestHeaders {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function request(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_RUNTIME_BASE_URL}${path}`, {
    method,
    headers: authorizationHeaders(token),
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

async function responseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();

  expect(text.length).toBeGreaterThan(0);

  const parsed: unknown = JSON.parse(text);

  expect(parsed).not.toBeNull();
  expect(typeof parsed).toBe('object');
  expect(Array.isArray(parsed)).toBe(false);

  return parsed as Record<string, unknown>;
}

function expectErrorCode(
  body: Record<string, unknown>,
  expectedCode: string,
): void {
  expect(body.code).toBe(expectedCode);
}

function describeWhenTokenExists(
  token: string | undefined,
  label: string,
  callback: () => void,
): void {
  if (token !== undefined && token.trim().length > 0) {
    describe(label, callback);
    return;
  }

  describe.skip(
    `${label} (token not configured)`,
    callback,
  );
}

describeWhenTokenExists(
  NEW_OWNER_TOKEN,
  'Question Bank authenticated HTTP — current OWNER',
  () => {
    it('allows the current OWNER to read Question assignments', async () => {
      const token = getConfiguredToken(
        NEW_OWNER_TOKEN,
        'QUESTION_BANK_NEW_OWNER_TOKEN',
      );

      const response = await request(
        `/question-bank/questions/${QUESTION_ID}/assignments`,
        token,
      );

      expect(response.status).toBe(200);

      const body: unknown = await response.json();

      expect(Array.isArray(body)).toBe(true);
    });
  },
);

describeWhenTokenExists(
  FORMER_OWNER_TOKEN,
  'Question Bank authenticated HTTP — former OWNER',
  () => {
    it('denies the former OWNER access to the assignment list', async () => {
      const token = getConfiguredToken(
        FORMER_OWNER_TOKEN,
        'QUESTION_BANK_FORMER_OWNER_TOKEN',
      );

      const response = await request(
        `/question-bank/questions/${QUESTION_ID}/assignments`,
        token,
      );

      expect(response.status).toBe(403);

      const body = await responseBody(response);

      expectErrorCode(
        body,
        'QUESTION_BANK_ACCESS_DENIED',
      );
    });
  },
);

describeWhenTokenExists(
  INSUFFICIENT_SCOPE_TOKEN,
  'Question Bank authenticated HTTP — missing write scope',
  () => {
    it('rejects a token without write:question-bank', async () => {
      const token = getConfiguredToken(
        INSUFFICIENT_SCOPE_TOKEN,
        'QUESTION_BANK_INSUFFICIENT_SCOPE_TOKEN',
      );

      const response = await request(
        `/question-bank/questions/${QUESTION_ID}/assignments`,
        token,
      );

      expect(response.status).toBe(403);

      const body = await responseBody(response);

      expectErrorCode(body, 'INSUFFICIENT_SCOPE');
    });
  },
);

describeWhenTokenExists(
  NO_MANAGE_SCOPE_TOKEN,
  'Question Bank authenticated HTTP — missing assignment-management scope',
  () => {
    it('rejects assignment management without manage:question-bank-access', async () => {
      const token = getConfiguredToken(
        NO_MANAGE_SCOPE_TOKEN,
        'QUESTION_BANK_NO_MANAGE_SCOPE_TOKEN',
      );

      const response = await request(
        `/question-bank/questions/${QUESTION_ID}/assignments`,
        token,
        'POST',
        {
          principalId: TEST_RECIPIENT_ID,
          role: 'EDITOR',
        },
      );

      expect(response.status).toBe(403);

      const body = await responseBody(response);

      expectErrorCode(
        body,
        'INSUFFICIENT_SCOPE',
      );
    });
  },
);

describeWhenTokenExists(
  UNPROVISIONED_TOKEN,
  'Question Bank authenticated HTTP — unprovisioned identity',
  () => {
    it('rejects a validly authenticated but unprovisioned identity', async () => {
      const token = getConfiguredToken(
        UNPROVISIONED_TOKEN,
        'QUESTION_BANK_UNPROVISIONED_TOKEN',
      );

      const response = await request(
        `/question-bank/questions/${QUESTION_ID}/assignments`,
        token,
      );

      expect(response.status).toBe(403);

      const body = await responseBody(response);

      expectErrorCode(body, 'IDENTITY_NOT_PROVISIONED');
    });
  },
);
