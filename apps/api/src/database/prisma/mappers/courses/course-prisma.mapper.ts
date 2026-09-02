import {
  Course,
  CourseId,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
  type CourseProps,
} from '@gurusthalam/courses';

import type {
  CourseModel,
  CourseLevel as PrismaCourseLevel,
  CourseStatus as PrismaCourseStatus,
  CourseType as PrismaCourseType,
  CourseVisibility as PrismaCourseVisibility,
} from '@gurusthalam/database';

export type PrismaCourseRecord = CourseModel;

export interface PrismaCoursePersistence {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: PrismaCourseLevel;
  readonly type: PrismaCourseType;
  readonly visibility: PrismaCourseVisibility;
  readonly status: PrismaCourseStatus;
  readonly instructorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CoursePrismaMapper {
  private constructor() {
    // Static mapper; instantiation is intentionally disabled.
  }

  static toDomain(record: PrismaCourseRecord): Course {
    return Course.rehydrate({
      id: CourseId.from(record.id),
      title: record.title,
      description: record.description,
      level: CoursePrismaMapper.toDomainLevel(record.level),
      type: CoursePrismaMapper.toDomainType(record.type),
      visibility: CoursePrismaMapper.toDomainVisibility(
        record.visibility,
      ),
      status: CoursePrismaMapper.toDomainStatus(record.status),
      instructorId: record.instructorId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  static toPersistence(
    course: Course,
  ): PrismaCoursePersistence {
    const props = course.toPrimitives();

    return {
      id: props.id.value,
      title: props.title,
      description: props.description,
      level: CoursePrismaMapper.toPrismaLevel(props.level),
      type: CoursePrismaMapper.toPrismaType(props.type),
      visibility: CoursePrismaMapper.toPrismaVisibility(
        props.visibility,
      ),
      status: CoursePrismaMapper.toPrismaStatus(props.status),
      instructorId: props.instructorId,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  private static toDomainLevel(
    value: PrismaCourseLevel,
  ): CourseProps['level'] {
    switch (value) {
      case 'BEGINNER':
        return CourseLevel.BEGINNER;

      case 'INTERMEDIATE':
        return CourseLevel.INTERMEDIATE;

      case 'ADVANCED':
        return CourseLevel.ADVANCED;

      case 'ALL_LEVELS':
        return CourseLevel.ALL_LEVELS;
    }

    throw new TypeError(
      `Unsupported Prisma CourseLevel: ${String(value)}`,
    );
  }

  private static toPrismaLevel(
    value: CourseProps['level'],
  ): PrismaCourseLevel {
    switch (value) {
      case CourseLevel.BEGINNER:
        return 'BEGINNER';

      case CourseLevel.INTERMEDIATE:
        return 'INTERMEDIATE';

      case CourseLevel.ADVANCED:
        return 'ADVANCED';

      case CourseLevel.ALL_LEVELS:
        return 'ALL_LEVELS';
    }

    throw new TypeError(
      `Unsupported domain CourseLevel: ${String(value)}`,
    );
  }

  private static toDomainType(
    value: PrismaCourseType,
  ): CourseProps['type'] {
    switch (value) {
      case 'SELF_PACED':
        return CourseType.SELF_PACED;

      case 'LIVE':
        return CourseType.LIVE;

      case 'BLENDED':
        return CourseType.BLENDED;
    }

    throw new TypeError(
      `Unsupported Prisma CourseType: ${String(value)}`,
    );
  }

  private static toPrismaType(
    value: CourseProps['type'],
  ): PrismaCourseType {
    switch (value) {
      case CourseType.SELF_PACED:
        return 'SELF_PACED';

      case CourseType.LIVE:
        return 'LIVE';

      case CourseType.BLENDED:
        return 'BLENDED';
    }

    throw new TypeError(
      `Unsupported domain CourseType: ${String(value)}`,
    );
  }

  private static toDomainVisibility(
    value: PrismaCourseVisibility,
  ): CourseProps['visibility'] {
    switch (value) {
      case 'PRIVATE':
        return CourseVisibility.PRIVATE;

      case 'UNLISTED':
        return CourseVisibility.UNLISTED;

      case 'PUBLIC':
        return CourseVisibility.PUBLIC;
    }

    throw new TypeError(
      `Unsupported Prisma CourseVisibility: ${String(value)}`,
    );
  }

  private static toPrismaVisibility(
    value: CourseProps['visibility'],
  ): PrismaCourseVisibility {
    switch (value) {
      case CourseVisibility.PRIVATE:
        return 'PRIVATE';

      case CourseVisibility.UNLISTED:
        return 'UNLISTED';

      case CourseVisibility.PUBLIC:
        return 'PUBLIC';
    }

    throw new TypeError(
      `Unsupported domain CourseVisibility: ${String(value)}`,
    );
  }

  private static toDomainStatus(
    value: PrismaCourseStatus,
  ): CourseProps['status'] {
    switch (value) {
      case 'DRAFT':
        return CourseStatus.DRAFT;

      case 'IN_REVIEW':
        return CourseStatus.IN_REVIEW;

      case 'PUBLISHED':
        return CourseStatus.PUBLISHED;

      case 'UNPUBLISHED':
        return CourseStatus.UNPUBLISHED;

      case 'ARCHIVED':
        return CourseStatus.ARCHIVED;
    }

    throw new TypeError(
      `Unsupported Prisma CourseStatus: ${String(value)}`,
    );
  }

  private static toPrismaStatus(
    value: CourseProps['status'],
  ): PrismaCourseStatus {
    switch (value) {
      case CourseStatus.DRAFT:
        return 'DRAFT';

      case CourseStatus.IN_REVIEW:
        return 'IN_REVIEW';

      case CourseStatus.PUBLISHED:
        return 'PUBLISHED';

      case CourseStatus.UNPUBLISHED:
        return 'UNPUBLISHED';

      case CourseStatus.ARCHIVED:
        return 'ARCHIVED';
    }

    throw new TypeError(
      `Unsupported domain CourseStatus: ${String(value)}`,
    );
  }
}