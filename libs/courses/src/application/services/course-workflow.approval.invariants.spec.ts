import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import {
  COURSE_STATUSES,
  CourseStatus,
} from '../../domain/enums/course-status.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseDomainEventName } from '../../domain/events/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('Course workflow approval semantics — 4.8-H', () => {
  const createRepositoryMock = (): {
    repository: CourseRepository;
    findById: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn();

    const exists = vi.fn();

    const save = vi.fn();

    return {
      repository: {
        findById,
        exists,
        save,
      } as unknown as CourseRepository,

      findById,

      exists,

      save,
    };
  };

  const createCourse = (): Course =>
    Course.create({
      title: 'Approval Semantics Course',
      description: 'Course used to protect review approval workflow semantics.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-approval-semantics-001',
    });

  it('keeps APPROVED out of the persisted Course lifecycle status vocabulary', () => {
    expect(COURSE_STATUSES).toEqual([
      CourseStatus.DRAFT,
      CourseStatus.IN_REVIEW,
      CourseStatus.PUBLISHED,
      CourseStatus.UNPUBLISHED,
      CourseStatus.ARCHIVED,
    ]);

    expect(COURSE_STATUSES).not.toContain('APPROVED' as never);

    expect(Object.values(CourseStatus)).not.toContain('APPROVED' as never);
  });

  it('does not expose an approve application command on DefaultCourseApplicationService', () => {
    const { repository } = createRepositoryMock();

    const service = new DefaultCourseApplicationService(repository);

    expect('approve' in service).toBe(false);
  });

  it('represents an approved review outcome through the existing publish command', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.submitForReview();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await service.publish({
      courseId: course.id.toString(),
    });

    expect(course.status).toBe(CourseStatus.PUBLISHED);

    expect(course.status).not.toBe('APPROVED' as never);

    expect(save).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledWith(course);

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event?.eventName).toBe(CourseDomainEventName.PUBLISHED);

    if (
      event === undefined ||
      event.eventName !== CourseDomainEventName.PUBLISHED
    ) {
      throw new Error('Expected CoursePublished domain event.');
    }

    expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

    expect(event.payload.currentStatus).toBe(CourseStatus.PUBLISHED);
  });

  it('keeps request changes as the distinct non-publication review outcome', () => {
    const course = createCourse();

    course.submitForReview();

    course.pullDomainEvents();

    course.requestChanges();

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(course.status).not.toBe('APPROVED' as never);

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event?.eventName).toBe(CourseDomainEventName.CHANGES_REQUESTED);

    if (
      event === undefined ||
      event.eventName !== CourseDomainEventName.CHANGES_REQUESTED
    ) {
      throw new Error('Expected CourseChangesRequested domain event.');
    }

    expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

    expect(event.payload.currentStatus).toBe(CourseStatus.DRAFT);
  });
});
