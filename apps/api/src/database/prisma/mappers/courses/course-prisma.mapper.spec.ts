import {
  Course,
  CourseActorId,
  CourseId,
  CourseLevel,
  CourseOwnership,
  CourseOwnershipRole,
  CourseStatus,
  CourseType,
  CourseVisibility,
  createCourseOwnershipAssignment,
} from '@gurusthalam/courses';

import type {
  CourseModel,
  CourseOwnershipAssignmentModel,
} from '@gurusthalam/database';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CoursePrismaMapper,
  type PrismaCourseRecord,
} from './course-prisma.mapper.js';

describe('CoursePrismaMapper', () => {
  const createdAt =
    new Date('2026-01-01T10:00:00.000Z');

  const updatedAt =
    new Date('2026-01-02T10:00:00.000Z');

  const record: CourseModel = {
    id: 'course-001',
    title: 'Advanced TypeScript',
    description: 'A complete TypeScript course.',
    level: 'ADVANCED',
    type: 'SELF_PACED',
    visibility: 'PUBLIC',
    status: 'DRAFT',
    instructorId: 'instructor-001',
    createdAt,
    updatedAt,
  };

  const ownerAssignment =
    createCourseOwnershipAssignment({
      principalId:
        CourseActorId.from('owner-001'),
      role: CourseOwnershipRole.OWNER,
    });

  const authorAssignment =
    createCourseOwnershipAssignment({
      principalId:
        CourseActorId.from('author-001'),
      role: CourseOwnershipRole.AUTHOR,
    });

  const ownershipRecords: CourseOwnershipAssignmentModel[] =
    [
      {
        courseId: 'course-001',
        principalId: 'owner-001',
        role: 'OWNER',
        position: 0,
      },
      {
        courseId: 'course-001',
        principalId: 'author-001',
        role: 'AUTHOR',
        position: 1,
      },
    ];

  it('rehydrates a Prisma Course into the domain', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
      );

    expect(course).toBeInstanceOf(Course);
    expect(course.id.value).toBe(record.id);
    expect(course.title).toBe(record.title);
    expect(course.description).toBe(
      record.description,
    );
    expect(course.level).toBe(
      CourseLevel.ADVANCED,
    );
    expect(course.type).toBe(
      CourseType.SELF_PACED,
    );
    expect(course.visibility).toBe(
      CourseVisibility.PUBLIC,
    );
    expect(course.status).toBe(
      CourseStatus.DRAFT,
    );
    expect(course.instructorId).toBe(
      record.instructorId,
    );
    expect(course.createdAt).toEqual(
      createdAt,
    );
    expect(course.updatedAt).toEqual(
      updatedAt,
    );

    expect(course.ownership.size).toBe(0);
    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('maps a domain Course into Prisma persistence data', () => {
    const course =
      Course.rehydrate({
        id: CourseId.from(record.id),
        title: record.title,
        description: record.description,
        level: CourseLevel.ADVANCED,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PUBLIC,
        status: CourseStatus.DRAFT,
        instructorId: record.instructorId,
        createdAt,
        updatedAt,
      });

    const persistence =
      CoursePrismaMapper.toPersistence(
        course,
      );

    expect(persistence).toEqual(record);
  });

  it('rehydrates Course ownership together with the Course', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        ownershipRecords,
      );

    expect(course.ownership).toBeInstanceOf(
      CourseOwnership,
    );

    expect(course.ownership.size).toBe(2);

    const owner =
      course.ownership.getOwner();

    expect(owner).not.toBeNull();
    expect(
      owner?.principalId.toString(),
    ).toBe('owner-001');
    expect(owner?.role).toBe(
      CourseOwnershipRole.OWNER,
    );

    const authors =
      course.ownership.getForRole(
        CourseOwnershipRole.AUTHOR,
      );

    expect(authors).toHaveLength(1);
    expect(
      authors[0]?.principalId.toString(),
    ).toBe('author-001');
  });

  it('preserves deterministic ownership order from persisted position', () => {
    const reversedRecords: CourseOwnershipAssignmentModel[] =
      [
        {
          courseId: 'course-001',
          principalId: 'author-001',
          role: 'AUTHOR',
          position: 1,
        },
        {
          courseId: 'course-001',
          principalId: 'owner-001',
          role: 'OWNER',
          position: 0,
        },
      ];

    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        reversedRecords,
      );

    const assignments =
      course.ownership.getAssignments();

    expect(assignments).toHaveLength(2);

    expect(
      assignments[0]?.principalId.toString(),
    ).toBe('owner-001');

    expect(
      assignments[0]?.role,
    ).toBe(
      CourseOwnershipRole.OWNER,
    );

    expect(
      assignments[1]?.principalId.toString(),
    ).toBe('author-001');

    expect(
      assignments[1]?.role,
    ).toBe(
      CourseOwnershipRole.AUTHOR,
    );
  });

  it('preserves ownership invariants during rehydration', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        ownershipRecords,
      );

    expect(
      course.ownership.has(
        CourseActorId.from('owner-001'),
        CourseOwnershipRole.OWNER,
      ),
    ).toBe(true);

    expect(
      course.ownership.has(
        CourseActorId.from('author-001'),
        CourseOwnershipRole.AUTHOR,
      ),
    ).toBe(true);

    expect(
      course.ownership.hasOwner(),
    ).toBe(true);
  });

  it('preserves null descriptions', () => {
    const course =
      CoursePrismaMapper.toDomain({
        ...record,
        description: null,
      } as PrismaCourseRecord);

    expect(course.description).toBeNull();

    const persistence =
      CoursePrismaMapper.toPersistence(
        course,
      );

    expect(
      persistence.description,
    ).toBeNull();
  });

  it('preserves timestamps as independent Date instances', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
      );

    const persistence =
      CoursePrismaMapper.toPersistence(
        course,
      );

    expect(
      persistence.createdAt,
    ).not.toBe(course.createdAt);

    expect(
      persistence.updatedAt,
    ).not.toBe(course.updatedAt);

    expect(
      persistence.createdAt,
    ).toEqual(createdAt);

    expect(
      persistence.updatedAt,
    ).toEqual(updatedAt);
  });

  it('does not generate domain events during rehydration', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        ownershipRecords,
      );

    expect(
      course.getDomainEvents(),
    ).toHaveLength(0);
  });

  it('rehydrates an empty ownership collection when no ownership rows exist', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        [],
      );

    expect(course.ownership.size).toBe(0);
    expect(course.ownership.hasOwner()).toBe(
      false,
    );
  });

  it('keeps ownership separate from the legacy Course persistence shape', () => {
    const ownership =
      CourseOwnership.create([
        ownerAssignment,
        authorAssignment,
      ]);

    const course =
      Course.rehydrate(
        {
          id: CourseId.from(record.id),
          title: record.title,
          description: record.description,
          level: CourseLevel.ADVANCED,
          type: CourseType.SELF_PACED,
          visibility: CourseVisibility.PUBLIC,
          status: CourseStatus.DRAFT,
          instructorId: record.instructorId,
          createdAt,
          updatedAt,
        },
        ownership,
      );

    const persistence =
      CoursePrismaMapper.toPersistence(
        course,
      );

    expect(
      Object.prototype.hasOwnProperty.call(
        persistence,
        'ownership',
      ),
    ).toBe(false);

    expect(
      Object.prototype.hasOwnProperty.call(
        persistence,
        'ownershipAssignments',
      ),
    ).toBe(false);
  });

  it('does not mutate ownership supplied by the caller', () => {
    const ownership =
      CourseOwnership.create([
        ownerAssignment,
        authorAssignment,
      ]);

    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
        ownershipRecords,
      );

    expect(course.ownership.size).toBe(
      ownership.size,
    );

    expect(
      course.ownership.getOwner()
        ?.principalId.toString(),
    ).toBe(
      ownership.getOwner()
        ?.principalId.toString(),
    );

    expect(
      course.ownership.getAssignments(),
    ).not.toBe(
      ownership.getAssignments(),
    );
  });
});