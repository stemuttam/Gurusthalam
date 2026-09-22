import { describe, expect, it } from 'vitest';

import type {
  AssignCourseOwnershipDto,
  ArchiveCourseDto,
  CreateCourseDto,
  CreateCourseVersionDto,
  GetCourseDto,
  PublishCourseDto,
  PublishCourseVersionDto,
  RemoveCourseOwnershipDto,
  ReplaceCourseOwnershipDto,
  RequestCourseChangesDto,
  SubmitCourseForReviewDto,
  UnpublishCourseDto,
  UpdateCourseMetadataDto,
} from './index.js';

describe('Course HTTP DTO contracts', () => {
  it('accepts the CreateCourseDto contract', () => {
    const accept = (input: CreateCourseDto): CreateCourseDto => input;

    const input = accept({
      title: 'Physics',
      description: 'Introduction to physics',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PRIVATE',
      instructorId: 'instructor-001',
      ownership: [
        {
          principalId: 'principal-001',
          role: 'OWNER',
        },
      ],
    });

    expect(input.title).toBe('Physics');
  });

  it('accepts the GetCourseDto contract', () => {
    const accept = (input: GetCourseDto): GetCourseDto => input;

    const input = accept({
      courseId: 'course-001',
    });

    expect(input.courseId).toBe('course-001');
  });

  it('accepts the UpdateCourseMetadataDto contract', () => {
    const accept = (input: UpdateCourseMetadataDto): UpdateCourseMetadataDto =>
      input;

    const input = accept({
      title: 'Updated Physics',
    });

    expect(input.title).toBe('Updated Physics');
  });

  it('accepts ownership assignment DTOs', () => {
    const acceptAssign = (
      input: AssignCourseOwnershipDto,
    ): AssignCourseOwnershipDto => input;

    const acceptRemove = (
      input: RemoveCourseOwnershipDto,
    ): RemoveCourseOwnershipDto => input;

    const assign = acceptAssign({
      principalId: 'principal-001',
      role: 'OWNER',
    });

    const remove = acceptRemove({
      principalId: 'principal-001',
      role: 'OWNER',
    });

    expect(assign.role).toBe('OWNER');
    expect(remove.role).toBe('OWNER');
  });

  it('accepts complete ownership replacement DTOs', () => {
    const accept = (
      input: ReplaceCourseOwnershipDto,
    ): ReplaceCourseOwnershipDto => input;

    const input = accept({
      assignments: [
        {
          principalId: 'principal-001',
          role: 'OWNER',
        },
      ],
    });

    expect(input.assignments).toHaveLength(1);
  });

  it('keeps lifecycle command DTOs body-free', () => {
    const submit: SubmitCourseForReviewDto = {};
    const changes: RequestCourseChangesDto = {};
    const publish: PublishCourseDto = {};
    const unpublish: UnpublishCourseDto = {};
    const archive: ArchiveCourseDto = {};

    expect(submit).toEqual({});
    expect(changes).toEqual({});
    expect(publish).toEqual({});
    expect(unpublish).toEqual({});
    expect(archive).toEqual({});
  });

  it('keeps CourseVersion creation body-free', () => {
    const input: CreateCourseVersionDto = {};

    expect(input).toEqual({});
  });

  it('keeps CourseVersion publication body-free', () => {
    const input: PublishCourseVersionDto = {};

    expect(input).toEqual({});
  });
});
