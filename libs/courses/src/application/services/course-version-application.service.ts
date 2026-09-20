import { CourseValidationError } from '../../domain/errors/index.js';

import { CourseVersion } from '../../domain/entities/course-version.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import type {
  CourseVersionApplicationService,
  CreateCourseVersionInput,
} from '../contracts/course-version-application.contracts.js';

import { createCourseVersionInputSchema } from '../contracts/course-version-application.validation.js';

/**
 * Default application service for CourseVersion creation.
 *
 * This class deliberately depends only on domain-level repository
 * contracts and domain entities.
 *
 * It contains no:
 * - Prisma;
 * - NestJS;
 * - HTTP;
 * - database-specific types;
 * - authorization implementation;
 * - AI/ML concerns.
 */
export class DefaultCourseVersionApplicationService implements CourseVersionApplicationService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseVersionRepository: CourseVersionRepository,
  ) {}

  async createVersion(input: CreateCourseVersionInput): Promise<CourseVersion> {
    const validatedInput = createCourseVersionInputSchema.parse(input);

    const courseId = CourseId.from(validatedInput.courseId);

    const course = await this.courseRepository.findById(courseId);

    if (course === null) {
      throw new CourseValidationError('Course was not found.', [
        {
          field: 'courseId',
          message: 'The specified Course does not exist.',
        },
      ]);
    }

    const latestVersion =
      await this.courseVersionRepository.findLatestByCourseId(courseId);

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    /**
     * The database composite uniqueness constraint on
     * (courseId, version) remains the concurrency boundary.
     *
     * We intentionally do not perform an existsByCourseIdAndVersion()
     * preflight because two concurrent callers may both observe the same
     * latest version. The persistence layer must arbitrate that race.
     */
    const courseVersion = CourseVersion.create({
      courseId: course.id.toString(),
      version: nextVersion,
      title: course.title,
      description: course.description,
    });

    await this.courseVersionRepository.save(courseVersion);

    return courseVersion;
  }
}
