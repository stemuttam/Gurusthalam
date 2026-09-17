import {
  CourseActorId,
  CourseOwnership,
  CourseOwnershipRole,
  createCourseOwnershipAssignment,
} from '@gurusthalam/courses';

import type {
  CourseOwnershipAssignmentModel,
} from '@gurusthalam/database';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CourseOwnershipPrismaMapper,
  type PrismaCourseOwnershipAssignmentRecord,
} from './course-ownership-prisma.mapper.js';

describe(
  'CourseOwnershipPrismaMapper',
  () => {
    const ownerAssignment =
      createCourseOwnershipAssignment({
        principalId:
          CourseActorId.from(
            'owner-001',
          ),
        role:
          CourseOwnershipRole.OWNER,
      });

    const authorAssignment =
      createCourseOwnershipAssignment({
        principalId:
          CourseActorId.from(
            'author-001',
          ),
        role:
          CourseOwnershipRole.AUTHOR,
      });

    const records = [
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
    ] as unknown as PrismaCourseOwnershipAssignmentRecord[];

    it(
      'rehydrates a Prisma ownership assignment into the domain',
      () => {
        const result =
          CourseOwnershipPrismaMapper.toDomain(
            records[0] as CourseOwnershipAssignmentModel,
          );

        expect(
          result.principalId.equals(
            ownerAssignment.principalId,
          ),
        ).toBe(true);

        expect(result.role).toBe(
          CourseOwnershipRole.OWNER,
        );
      },
    );

    it(
      'maps all persisted assignments in deterministic position order',
      () => {
        const reversed = [
          records[1],
          records[0],
        ] as PrismaCourseOwnershipAssignmentRecord[];

        const result =
          CourseOwnershipPrismaMapper.toDomainMany(
            reversed,
          );

        expect(result).toHaveLength(2);
        expect(result[0]?.role).toBe(
          CourseOwnershipRole.OWNER,
        );
        expect(result[1]?.role).toBe(
          CourseOwnershipRole.AUTHOR,
        );
      },
    );

    it(
      'maps a domain ownership assignment to persistence data',
      () => {
        const result =
          CourseOwnershipPrismaMapper.toPersistence(
            'course-001',
            ownerAssignment,
            0,
          );

        expect(result).toEqual({
          courseId: 'course-001',
          principalId: 'owner-001',
          role: 'OWNER',
          position: 0,
        });
      },
    );

    it(
      'maps the complete ownership value object preserving order',
      () => {
        const ownership =
          CourseOwnership.create([
            ownerAssignment,
            authorAssignment,
          ]);

        const result =
          CourseOwnershipPrismaMapper.toPersistenceMany(
            'course-001',
            ownership,
          );

        expect(result).toEqual([
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
        ]);
      },
    );

    it(
      'does not resolve or authorize external principals',
      () => {
        const result =
          CourseOwnershipPrismaMapper.toDomain(
            records[1] as CourseOwnershipAssignmentModel,
          );

        expect(result.principalId).toBeInstanceOf(
          CourseActorId,
        );

        expect(result.role).toBe(
          CourseOwnershipRole.AUTHOR,
        );
      },
    );
  },
);