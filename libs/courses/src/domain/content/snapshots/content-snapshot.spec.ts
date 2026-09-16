import { describe, expect, it } from 'vitest';

import {
  CONTENT_SNAPSHOT_SCHEMA_VERSION,
  createContentSnapshot,
} from './content-snapshot.js';
import { Content } from '../entities/content.js';
import { ContentType } from '../enums/content-type.js';
import { ContentId } from '../identifiers/content-id.js';

describe('ContentSnapshot', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');

  const createContent = (): Content =>
    Content.create({
      type: ContentType.PDF,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/course.pdf',
      },
      metadata: {
        values: {
          pages: 12,
          language: 'en',
          searchable: true,
        },
      },
      accessibility: {
        features: ['screen-reader', 'captions'],
      },
      availability: {
        enabled: true,
        availableFrom: new Date('2026-01-03T00:00:00.000Z'),
        availableUntil: new Date('2026-12-31T23:59:59.000Z'),
      },
      createdAt,
      updatedAt,
    });

  it('creates a complete immutable Content snapshot', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);

    expect(snapshot).toEqual({
      snapshotSchemaVersion: CONTENT_SNAPSHOT_SCHEMA_VERSION,
      id: content.id.toString(),
      type: ContentType.PDF,
      version: 1,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/course.pdf',
      },
      metadata: {
        values: {
          pages: 12,
          language: 'en',
          searchable: true,
        },
      },
      accessibility: {
        features: ['screen-reader', 'captions'],
      },
      availability: {
        enabled: true,
        availableFrom: '2026-01-03T00:00:00.000Z',
        availableUntil: '2026-12-31T23:59:59.000Z',
      },
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('preserves Content identity and version independently', () => {
    const id = ContentId.from('content-versioned-001');

    const content = Content.rehydrate({
      id,
      type: ContentType.DOCUMENT,
      version: 7,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/document.pdf',
      },
      metadata: {
        values: {
          revision: 'seven',
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

    const snapshot = createContentSnapshot(content);

    expect(snapshot.id).toBe('content-versioned-001');

    expect(snapshot.version).toBe(7);
  });

  it('preserves null availability boundaries', () => {
    const content = Content.create({
      type: ContentType.NOTE,
      source: {
        kind: 'INLINE',
        locator: 'note-001',
      },
      availability: {
        enabled: true,
        availableFrom: null,
        availableUntil: null,
      },
      createdAt,
      updatedAt,
    });

    const snapshot = createContentSnapshot(content);

    expect(snapshot.availability).toEqual({
      enabled: true,
      availableFrom: null,
      availableUntil: null,
    });
  });

  it('preserves disabled availability state', () => {
    const content = Content.create({
      type: ContentType.VIDEO,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/video.mp4',
      },
      availability: {
        enabled: false,
        availableFrom: null,
        availableUntil: null,
      },
      createdAt,
      updatedAt,
    });

    const snapshot = createContentSnapshot(content);

    expect(snapshot.availability.enabled).toBe(false);
  });

  it('detaches nested source state', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);
    const primitives = content.toPrimitives();

    expect(snapshot.source).not.toBe(primitives.source);

    expect(snapshot.source.kind).toBe(primitives.source.kind);

    expect(snapshot.source.locator).toBe(primitives.source.locator);
  });

  it('detaches nested metadata state', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);
    const primitives = content.toPrimitives();

    expect(snapshot.metadata).not.toBe(primitives.metadata);

    expect(snapshot.metadata.values).not.toBe(primitives.metadata.values);

    expect(snapshot.metadata.values).toEqual(primitives.metadata.values);
  });

  it('detaches nested accessibility state', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);
    const primitives = content.toPrimitives();

    expect(snapshot.accessibility).not.toBe(primitives.accessibility);

    expect(snapshot.accessibility.features).not.toBe(
      primitives.accessibility.features,
    );

    expect(snapshot.accessibility.features).toEqual(
      primitives.accessibility.features,
    );
  });

  it('does not share Date instances with Content', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);

    expect(typeof snapshot.createdAt).toBe('string');

    expect(typeof snapshot.updatedAt).toBe('string');
  });

  it('does not contain persistence-specific or AI operational fields', () => {
    const content = createContent();

    const snapshot = createContentSnapshot(content);

    expect(snapshot).not.toHaveProperty('databaseId');

    expect(snapshot).not.toHaveProperty('embeddingId');

    expect(snapshot).not.toHaveProperty('vectorId');

    expect(snapshot).not.toHaveProperty('modelId');

    expect(snapshot).not.toHaveProperty('rankingScore');

    expect(snapshot).not.toHaveProperty('confidenceScore');
  });

  it('produces deterministic snapshots for unchanged Content', () => {
    const content = createContent();

    const firstSnapshot = createContentSnapshot(content);

    const secondSnapshot = createContentSnapshot(content);

    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});
