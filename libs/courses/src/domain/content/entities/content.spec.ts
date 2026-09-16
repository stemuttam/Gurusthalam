import { describe, expect, it } from 'vitest';

import { Content } from './content.js';
import { ContentType } from '../enums/content-type.js';
import { ContentId } from '../identifiers/content-id.js';
import { ContentAccessibility } from '../value-objects/content-accessibility.js';
import { ContentAvailability } from '../value-objects/content-availability.js';
import { ContentMetadata } from '../value-objects/content-metadata.js';
import { ContentSource } from '../value-objects/content-source.js';
import { ContentVersion } from '../value-objects/content-version.js';

describe('Content', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  const updatedAt = new Date('2026-01-01T01:00:00.000Z');

  it('creates a generic content entity with safe defaults', () => {
    const content = Content.create({
      type: ContentType.VIDEO,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/video.mp4',
      },
      createdAt,
      updatedAt,
    });

    expect(content.id).toBeInstanceOf(ContentId);

    expect(content.type).toBe(ContentType.VIDEO);

    expect(content.version.equals(ContentVersion.initial())).toBe(true);

    expect(content.source.kind).toBe('OBJECT_STORAGE');

    expect(content.metadata.equals(ContentMetadata.empty())).toBe(true);

    expect(content.accessibility.equals(ContentAccessibility.empty())).toBe(
      true,
    );

    expect(
      content.availability.equals(ContentAvailability.alwaysAvailable()),
    ).toBe(true);

    expect(content.createdAt).toEqual(createdAt);

    expect(content.updatedAt).toEqual(updatedAt);

    expect(Object.isFrozen(content)).toBe(true);
  });

  it('rehydrates primitive-friendly contracts', () => {
    const id = ContentId.from('content-123');

    const content = Content.rehydrate({
      id,
      type: ContentType.PDF,
      version: 4,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/course.pdf',
      },
      metadata: {
        values: {
          pages: 10,
        },
      },
      accessibility: {
        features: ['screen-reader'],
      },
      availability: {
        enabled: true,
        availableFrom: null,
        availableUntil: null,
      },
      createdAt,
      updatedAt,
    });

    expect(content.id.equals(id)).toBe(true);
    expect(content.version.toNumber()).toBe(4);

    expect(content.metadata.get('pages')).toBe(10);

    expect(content.accessibility.supports('screen-reader')).toBe(true);

    expect(content.toPrimitives()).toEqual({
      id: 'content-123',
      type: ContentType.PDF,
      version: 4,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/course.pdf',
      },
      metadata: {
        values: {
          pages: 10,
        },
      },
      accessibility: {
        features: ['screen-reader'],
      },
      availability: {
        enabled: true,
        availableFrom: null,
        availableUntil: null,
      },
      createdAt,
      updatedAt,
    });
  });

  it('rejects invalid timestamp chronology', () => {
    const invalidCreatedAt = new Date('2026-01-01T01:00:00.000Z');

    const invalidUpdatedAt = new Date('2026-01-01T00:00:00.000Z');

    expect(() =>
      Content.create({
        type: ContentType.NOTE,
        source: ContentSource.from({
          kind: 'INLINE',
          locator: 'note-1',
        }),
        createdAt: invalidCreatedAt,
        updatedAt: invalidUpdatedAt,
      }),
    ).toThrow('Content timestamps are invalid.');
  });

  it('rejects invalid timestamp values', () => {
    expect(() =>
      Content.create({
        type: ContentType.NOTE,
        source: ContentSource.from({
          kind: 'INLINE',
          locator: 'note-1',
        }),
        createdAt: new Date('invalid'),
      }),
    ).toThrow('Content timestamps are invalid.');
  });
});
