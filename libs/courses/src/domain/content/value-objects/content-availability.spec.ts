import { describe, expect, it } from 'vitest';

import { ContentAvailability } from './content-availability.js';

describe('ContentAvailability', () => {
  it('defaults to always available', () => {
    const availability = ContentAvailability.alwaysAvailable();

    expect(
      availability.isAvailableAt(new Date('2026-01-01T00:00:00.000Z')),
    ).toBe(true);

    expect(Object.isFrozen(availability)).toBe(true);
  });

  it('evaluates enabled availability windows inclusively', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');

    const until = new Date('2026-01-10T00:00:00.000Z');

    const availability = ContentAvailability.from({
      enabled: true,
      availableFrom: from,
      availableUntil: until,
    });

    expect(availability.isAvailableAt(from)).toBe(true);

    expect(
      availability.isAvailableAt(new Date('2026-01-05T00:00:00.000Z')),
    ).toBe(true);

    expect(availability.isAvailableAt(until)).toBe(true);

    expect(
      availability.isAvailableAt(new Date('2025-12-31T23:59:59.999Z')),
    ).toBe(false);

    expect(
      availability.isAvailableAt(new Date('2026-01-10T00:00:00.001Z')),
    ).toBe(false);
  });

  it('rejects reversed windows', () => {
    expect(() =>
      ContentAvailability.from({
        enabled: true,
        availableFrom: new Date('2026-02-01T00:00:00.000Z'),
        availableUntil: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toThrow();
  });

  it('clones supplied dates', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');

    const availability = ContentAvailability.from({
      enabled: true,
      availableFrom: from,
      availableUntil: null,
    });

    from.setUTCFullYear(2030);

    expect(availability.availableFrom?.getUTCFullYear()).toBe(2026);
  });
});
