import { describe, expect, it } from 'vitest';

import {
  DefaultCourseApplicationService,
  updateCourseInputSchema,
  updateMetadataInputSchema,
} from '@gurusthalam/courses';

import type {
  UpdateCourseInput,
  UpdateMetadataInput,
} from '@gurusthalam/courses';

describe('Course UpdateMetadata package consumer contract — 4.10-E', () => {
  it('exposes UpdateMetadata through the public @gurusthalam/courses boundary', () => {
    expect(DefaultCourseApplicationService).toBeDefined();
    expect(updateMetadataInputSchema).toBeDefined();
    expect(updateMetadataInputSchema).toBe(updateCourseInputSchema);
  });

  it('accepts the canonical UpdateMetadata input shape', () => {
    const parsed = updateMetadataInputSchema.parse({
      courseId: 'course-001',
      title: 'Updated Course',
    });

    expect(parsed).toEqual({
      courseId: 'course-001',
      title: 'Updated Course',
    });
  });

  it('keeps UpdateMetadata authorization-independent', () => {
    expect(() =>
      updateMetadataInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        actorId: 'actor-001',
      }),
    ).toThrow();
  });

  it('keeps the compatibility UpdateCourse type assignable to UpdateMetadata', () => {
    const updateCourseInput: UpdateCourseInput = {
      courseId: 'course-001',
      title: 'Updated Course',
    };

    const updateMetadataInput: UpdateMetadataInput = updateCourseInput;

    expect(updateMetadataInput).toEqual(updateCourseInput);
  });
});
