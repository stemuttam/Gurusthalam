import { describe, expect, it } from 'vitest';

import type { ProgressRepository } from './progress-repository.js';

describe('ProgressRepository contract', () => {
  it('exposes the required persistence operations', () => {
    const repository: ProgressRepository = {
      findById: async () => null,

      findByEnrollmentId: async () => null,

      save: async () => undefined,
    };

    expect(repository.findById).toBeTypeOf('function');

    expect(repository.findByEnrollmentId).toBeTypeOf('function');

    expect(repository.save).toBeTypeOf('function');
  });
});
