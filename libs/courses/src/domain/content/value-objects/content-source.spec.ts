import { describe, expect, it } from 'vitest';

import { ContentSource } from './content-source.js';

describe('ContentSource', () => {
  it('creates and freezes a generic source descriptor', () => {
    const source = ContentSource.from({
      kind: 'OBJECT_STORAGE',
      locator: 'bucket/key/video.mp4',
    });

    expect(source.kind).toBe('OBJECT_STORAGE');
    expect(source.locator).toBe('bucket/key/video.mp4');
    expect(Object.isFrozen(source)).toBe(true);
  });

  it.each([
    { kind: '', locator: 'key' },
    { kind: ' ', locator: 'key' },
    { kind: 'OBJECT_STORAGE ', locator: 'key' },
    { kind: 'OBJECT_STORAGE', locator: '' },
    { kind: 'OBJECT_STORAGE', locator: ' key' },
  ])('rejects non-canonical source %j', (value) => {
    expect(() => ContentSource.from(value)).toThrow();
    expect(ContentSource.isValid(value)).toBe(false);
  });

  it('returns detached primitive values', () => {
    const source = ContentSource.from({
      kind: 'URL',
      locator: 'https://example.com',
    });

    const primitives = source.toPrimitives();

    expect(primitives).toEqual({
      kind: 'URL',
      locator: 'https://example.com',
    });

    expect(Object.isFrozen(primitives)).toBe(true);
    expect(source.equals(ContentSource.from(primitives))).toBe(true);
  });
});
