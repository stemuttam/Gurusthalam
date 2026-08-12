import {
  APP_NAME,
  API_VERSION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './app.constants.js';

import {
  ENVIRONMENT,
} from './environment.constants.js';

import {
  HTTP_STATUS,
} from './http.constants.js';

import {
  USER_ROLE,
} from './role.constants.js';

describe('Gurusthalam constants', () => {
  it('defines application identity', () => {
    expect(APP_NAME).toBe('Gurusthalam');
    expect(API_VERSION).toBe('v1');
  });

  it('defines pagination defaults', () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it('defines environments', () => {
    expect(ENVIRONMENT.PRODUCTION).toBe('production');
  });

  it('defines HTTP status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
  });

  it('defines learner role', () => {
    expect(USER_ROLE.LEARNER).toBe('learner');
  });
});