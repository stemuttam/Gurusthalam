import { describe, expect, it } from 'vitest';

import { ContentId } from './content-id.js';

describe('ContentId', () => {
  it('generates opaque UUID-shaped identifiers', () => {
    const id = ContentId.generate();

    expect(id).toBeInstanceOf(ContentId);
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rehydrates canonical identifiers', () => {
    const id = ContentId.from('content-123');

    expect(id.toString()).toBe('content-123');
    expect(ContentId.isValid('content-123')).toBe(true);
  });

  it.each(['', '   ', ' content-123', 'content-123 '])(
    'rejects invalid identifier %j',
    (value) => {
      expect(() => ContentId.from(value)).toThrow();
      expect(ContentId.isValid(value)).toBe(false);
    },
  );

  it('compares by value and freezes instances', () => {
    const first = ContentId.from('content-123');
    const second = ContentId.from('content-123');

    expect(first.equals(second)).toBe(true);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
