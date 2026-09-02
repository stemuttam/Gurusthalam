import {
  CourseVersion,
  CourseVersionId,
  type CourseVersionStatus,
} from '@gurusthalam/courses';

import type {
  CourseVersionModel,
  CourseVersionStatus as PrismaCourseVersionStatus,
} from '@gurusthalam/database';

export type PrismaCourseVersionRecord = CourseVersionModel;

export interface PrismaCourseVersionPersistence {
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly status: PrismaCourseVersionStatus;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
}

export class CourseVersionPrismaMapper {
  private constructor() {
    // Static mapper; instantiation is intentionally disabled.
  }

  static toDomain(
    record: PrismaCourseVersionRecord,
  ): CourseVersion {
    return CourseVersion.rehydrate({
      id: CourseVersionId.from(record.id),
      courseId: record.courseId,
      version: record.version,
      status: CourseVersionPrismaMapper.toDomainStatus(
        record.status,
      ),
      title: record.title,
      description: record.description,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      publishedAt:
        record.publishedAt === null
          ? null
          : new Date(record.publishedAt),
    });
  }

  static toPersistence(
    courseVersion: CourseVersion,
  ): PrismaCourseVersionPersistence {
    const props = courseVersion.toPrimitives();

    return {
      id: props.id.value,
      courseId: props.courseId,
      version: props.version,
      status: CourseVersionPrismaMapper.toPrismaStatus(
        props.status,
      ),
      title: props.title,
      description: props.description,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
      publishedAt:
        props.publishedAt === null
          ? null
          : new Date(props.publishedAt),
    };
  }

  private static toDomainStatus(
    value: PrismaCourseVersionStatus,
  ): CourseVersionStatus {
    switch (value) {
      case 'DRAFT':
        return 'DRAFT';

      case 'IN_REVIEW':
        return 'IN_REVIEW';

      case 'PUBLISHED':
        return 'PUBLISHED';

      case 'ARCHIVED':
        return 'ARCHIVED';
    }

    throw new TypeError(
      `Unsupported Prisma CourseVersionStatus: ${String(value)}`,
    );
  }

  private static toPrismaStatus(
    value: CourseVersionStatus,
  ): PrismaCourseVersionStatus {
    switch (value) {
      case 'DRAFT':
        return 'DRAFT';

      case 'IN_REVIEW':
        return 'IN_REVIEW';

      case 'PUBLISHED':
        return 'PUBLISHED';

      case 'ARCHIVED':
        return 'ARCHIVED';
    }

    throw new TypeError(
      `Unsupported domain CourseVersionStatus: ${String(value)}`,
    );
  }
}