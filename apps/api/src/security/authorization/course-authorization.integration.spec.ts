import {
  Course,
  CourseActorId,
  CourseLevel,
  CourseOwnershipRole,
  CourseType,
  CourseVisibility,
  createCourseOwnershipAssignment,
} from '@gurusthalam/courses';

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { Test } from '@nestjs/testing';

import { describe, expect, it } from 'vitest';

import { CourseAuthorizationModule } from './course-authorization.module.js';

import { CourseAuthorizationPolicy } from './course-authorization.policy.js';

import { CourseAuthorizationService } from './course-authorization.service.js';

import {
  CourseAuthorizationDecisionCode,
  CourseAuthorizationOperation,
} from './course-authorization.types.js';

import { RequestPrincipalResolver } from './request-principal.resolver.js';

function createIntegrationCourse(): Course {
  const course = Course.create({
    title: 'Course Authorization Integration Test',
    description: 'Authorization integration regression fixture.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'integration-instructor',
  });

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from('integration-owner'),
      role: CourseOwnershipRole.OWNER,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from('integration-author'),
      role: CourseOwnershipRole.AUTHOR,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from('integration-reviewer'),
      role: CourseOwnershipRole.REVIEWER,
    }),
  );

  course.addOwnershipAssignment(
    createCourseOwnershipAssignment({
      principalId: CourseActorId.from('integration-publisher'),
      role: CourseOwnershipRole.PUBLISHER,
    }),
  );

  return course;
}

describe('Course authorization integration', () => {
  it('composes the authorization module with its complete providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    expect(moduleRef.get(CourseAuthorizationPolicy)).toBeInstanceOf(
      CourseAuthorizationPolicy,
    );

    expect(moduleRef.get(CourseAuthorizationService)).toBeInstanceOf(
      CourseAuthorizationService,
    );

    expect(moduleRef.get(RequestPrincipalResolver)).toBeInstanceOf(
      RequestPrincipalResolver,
    );

    await moduleRef.close();
  });

  it('allows an authenticated Owner to update Course metadata', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    const decision = service.assertAuthorized(
      {
        authenticated: true,
        principalId: 'integration-owner',
      },
      createIntegrationCourse(),
      CourseAuthorizationOperation.UPDATE_METADATA,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe(CourseAuthorizationDecisionCode.ALLOWED);

    await moduleRef.close();
  });

  it('allows an authenticated Reviewer to request changes', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    const decision = service.assertAuthorized(
      {
        authenticated: true,
        principalId: 'integration-reviewer',
      },
      createIntegrationCourse(),
      CourseAuthorizationOperation.REQUEST_CHANGES,
    );

    expect(decision.allowed).toBe(true);

    await moduleRef.close();
  });

  it('allows an authenticated Publisher to publish', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    const decision = service.assertAuthorized(
      {
        authenticated: true,
        principalId: 'integration-publisher',
      },
      createIntegrationCourse(),
      CourseAuthorizationOperation.PUBLISH,
    );

    expect(decision.allowed).toBe(true);

    await moduleRef.close();
  });

  it('denies an authenticated Author from publishing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    expect(() =>
      service.assertAuthorized(
        {
          authenticated: true,
          principalId: 'integration-author',
        },
        createIntegrationCourse(),
        CourseAuthorizationOperation.PUBLISH,
      ),
    ).toThrow(ForbiddenException);

    await moduleRef.close();
  });

  it('denies an unauthenticated request before role evaluation', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    expect(() =>
      service.assertAuthorized(
        null,
        createIntegrationCourse(),
        CourseAuthorizationOperation.READ,
      ),
    ).toThrow(UnauthorizedException);

    await moduleRef.close();
  });

  it('denies an authenticated principal who has no Course ownership assignment', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    expect(() =>
      service.assertAuthorized(
        {
          authenticated: true,
          principalId: 'integration-unrelated-actor',
        },
        createIntegrationCourse(),
        CourseAuthorizationOperation.READ,
      ),
    ).toThrow(ForbiddenException);

    await moduleRef.close();
  });

  it('does not mutate the Course aggregate while authorizing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CourseAuthorizationModule],
    }).compile();

    const service = moduleRef.get(CourseAuthorizationService);

    const course = createIntegrationCourse();
    const ownershipBefore = course.ownership.getAssignments();
    const updatedAtBefore = course.updatedAt;

    service.assertAuthorized(
      {
        authenticated: true,
        principalId: 'integration-owner',
      },
      course,
      CourseAuthorizationOperation.UPDATE_METADATA,
    );

    expect(course.ownership.getAssignments()).toEqual(ownershipBefore);

    expect(course.updatedAt).toEqual(updatedAtBefore);

    await moduleRef.close();
  });
});
