import {
  Course,
  CourseActorId,
  CourseLevel,
  CourseOwnershipRole,
  CourseType,
  CourseVisibility,
  createCourseOwnershipAssignment,
} from '@gurusthalam/courses';

import { describe, expect, it } from 'vitest';

import { createAuthenticatedPrincipal } from './authenticated-principal.js';

import { CourseAuthorizationPolicy } from './course-authorization.policy.js';

import {
  CourseAuthorizationDecisionCode,
  CourseAuthorizationOperation,
} from './course-authorization.types.js';

const actorIds = {
  owner: 'authorization-owner',
  author: 'authorization-author',
  coAuthor: 'authorization-co-author',
  editor: 'authorization-editor',
  reviewer: 'authorization-reviewer',
  publisher: 'authorization-publisher',
} as const;

function createCourse(): Course {
  const course = Course.create({
    title: 'Authorization Test Course',
    description: 'Course used by the authorization policy tests.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-001',
  });

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.owner),
      role: CourseOwnershipRole.OWNER,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.author),
      role: CourseOwnershipRole.AUTHOR,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.coAuthor),
      role: CourseOwnershipRole.CO_AUTHOR,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.editor),
      role: CourseOwnershipRole.EDITOR,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.reviewer),
      role: CourseOwnershipRole.REVIEWER,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from(actorIds.publisher),
      role: CourseOwnershipRole.PUBLISHER,
    }),
  );

  return course;
}

describe('CourseAuthorizationPolicy', () => {
  const policy = new CourseAuthorizationPolicy();

  it('requires authentication when no principal exists', () => {
    const course = createCourse();

    const decision = policy.authorize(
      null,
      course,
      CourseAuthorizationOperation.READ,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe(
      CourseAuthorizationDecisionCode.AUTHENTICATION_REQUIRED,
    );
    expect(decision.principalId).toBeNull();
    expect(decision.actualRoles).toEqual([]);
  });

  it('denies an authenticated principal with no Course ownership role', () => {
    const course = createCourse();

    const decision = policy.authorize(
      createAuthenticatedPrincipal('unrelated-actor'),
      course,
      CourseAuthorizationOperation.READ,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe(CourseAuthorizationDecisionCode.FORBIDDEN);
    expect(decision.actualRoles).toEqual([]);
  });

  it('recognizes every approved Course ownership role', () => {
    const course = createCourse();

    for (const [role, principalId] of [
      [CourseOwnershipRole.OWNER, actorIds.owner],
      [CourseOwnershipRole.AUTHOR, actorIds.author],
      [CourseOwnershipRole.CO_AUTHOR, actorIds.coAuthor],
      [CourseOwnershipRole.EDITOR, actorIds.editor],
      [CourseOwnershipRole.REVIEWER, actorIds.reviewer],
      [CourseOwnershipRole.PUBLISHER, actorIds.publisher],
    ] as const) {
      const decision = policy.authorize(
        createAuthenticatedPrincipal(principalId),
        course,
        CourseAuthorizationOperation.READ,
      );

      expect(decision.allowed).toBe(true);
      expect(decision.code).toBe(CourseAuthorizationDecisionCode.ALLOWED);
      expect(decision.actualRoles).toEqual([role]);
    }
  });

  it('does not mutate the Course aggregate', () => {
    const course = createCourse();

    const ownershipBefore = course.ownership.getAssignments();
    const updatedAtBefore = course.updatedAt;

    policy.authorize(
      createAuthenticatedPrincipal(actorIds.owner),
      course,
      CourseAuthorizationOperation.UPDATE_METADATA,
    );

    expect(course.ownership.getAssignments()).toEqual(ownershipBefore);

    expect(course.updatedAt).toEqual(updatedAtBefore);
  });

  const operationExpectations: ReadonlyArray<{
    readonly operation: CourseAuthorizationOperation;
    readonly allowedRoles: readonly CourseOwnershipRole[];
  }> = [
    {
      operation: CourseAuthorizationOperation.READ,
      allowedRoles: [
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.CO_AUTHOR,
        CourseOwnershipRole.EDITOR,
        CourseOwnershipRole.REVIEWER,
        CourseOwnershipRole.PUBLISHER,
      ],
    },
    {
      operation: CourseAuthorizationOperation.UPDATE_METADATA,
      allowedRoles: [
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.CO_AUTHOR,
        CourseOwnershipRole.EDITOR,
      ],
    },
    {
      operation: CourseAuthorizationOperation.ASSIGN_OWNERSHIP,
      allowedRoles: [CourseOwnershipRole.OWNER],
    },
    {
      operation: CourseAuthorizationOperation.REMOVE_OWNERSHIP,
      allowedRoles: [CourseOwnershipRole.OWNER],
    },
    {
      operation: CourseAuthorizationOperation.REPLACE_OWNERSHIP,
      allowedRoles: [CourseOwnershipRole.OWNER],
    },
    {
      operation: CourseAuthorizationOperation.SUBMIT_FOR_REVIEW,
      allowedRoles: [
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.CO_AUTHOR,
        CourseOwnershipRole.EDITOR,
      ],
    },
    {
      operation: CourseAuthorizationOperation.REQUEST_CHANGES,
      allowedRoles: [CourseOwnershipRole.OWNER, CourseOwnershipRole.REVIEWER],
    },
    {
      operation: CourseAuthorizationOperation.PUBLISH,
      allowedRoles: [CourseOwnershipRole.OWNER, CourseOwnershipRole.PUBLISHER],
    },
    {
      operation: CourseAuthorizationOperation.UNPUBLISH,
      allowedRoles: [CourseOwnershipRole.OWNER, CourseOwnershipRole.PUBLISHER],
    },
    {
      operation: CourseAuthorizationOperation.ARCHIVE,
      allowedRoles: [CourseOwnershipRole.OWNER],
    },
    {
      operation: CourseAuthorizationOperation.CREATE_VERSION,
      allowedRoles: [
        CourseOwnershipRole.OWNER,
        CourseOwnershipRole.AUTHOR,
        CourseOwnershipRole.CO_AUTHOR,
        CourseOwnershipRole.EDITOR,
      ],
    },
    {
      operation: CourseAuthorizationOperation.PUBLISH_VERSION,
      allowedRoles: [CourseOwnershipRole.OWNER, CourseOwnershipRole.PUBLISHER],
    },
  ];

  for (const { operation, allowedRoles } of operationExpectations) {
    it(`implements the approved matrix for ${operation}`, () => {
      const course = createCourse();

      const principalsByRole: Readonly<Record<CourseOwnershipRole, string>> = {
        [CourseOwnershipRole.OWNER]: actorIds.owner,
        [CourseOwnershipRole.AUTHOR]: actorIds.author,
        [CourseOwnershipRole.CO_AUTHOR]: actorIds.coAuthor,
        [CourseOwnershipRole.EDITOR]: actorIds.editor,
        [CourseOwnershipRole.REVIEWER]: actorIds.reviewer,
        [CourseOwnershipRole.PUBLISHER]: actorIds.publisher,
      };

      for (const role of Object.values(CourseOwnershipRole)) {
        const decision = policy.authorize(
          createAuthenticatedPrincipal(principalsByRole[role]),
          course,
          operation,
        );

        expect(decision.allowed).toBe(allowedRoles.includes(role));

        expect(decision.code).toBe(
          allowedRoles.includes(role)
            ? CourseAuthorizationDecisionCode.ALLOWED
            : CourseAuthorizationDecisionCode.FORBIDDEN,
        );
      }
    });
  }
});
