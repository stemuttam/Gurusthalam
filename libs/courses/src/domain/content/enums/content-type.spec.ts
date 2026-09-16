import { describe, expect, it } from 'vitest';

import { CONTENT_TYPES, ContentType, isContentType } from './content-type.js';

describe('ContentType', () => {
  it('exposes the architecture-defined content modalities', () => {
    expect(CONTENT_TYPES).toEqual([
      ContentType.VIDEO,
      ContentType.AUDIO,
      ContentType.DOCUMENT,
      ContentType.PDF,
      ContentType.NOTE,
      ContentType.PRESENTATION,
      ContentType.INTERACTIVE,
      ContentType.CODE_EXERCISE,
      ContentType.SIMULATION,
      ContentType.EXTERNAL_RESOURCE,
      ContentType.AI_GENERATED_CONTENT,
    ]);
  });

  it('validates supported content types', () => {
    expect(isContentType(ContentType.VIDEO)).toBe(true);
    expect(isContentType('VIDEO')).toBe(true);
    expect(isContentType('unsupported')).toBe(false);
    expect(isContentType(null)).toBe(false);
  });
});
