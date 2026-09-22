export type {
  CreateCourseDto,
  CourseOwnershipAssignmentDto as CreateCourseOwnershipAssignmentDto,
} from './create-course.dto.js';

export type { GetCourseDto } from './get-course.dto.js';

export type { UpdateCourseMetadataDto } from './update-course-metadata.dto.js';

export type {
  AssignCourseOwnershipDto,
  RemoveCourseOwnershipDto,
  ReplaceCourseOwnershipDto,
  CourseOwnershipAssignmentDto,
} from './course-ownership.dto.js';

export type {
  SubmitCourseForReviewDto,
  RequestCourseChangesDto,
  PublishCourseDto,
  UnpublishCourseDto,
  ArchiveCourseDto,
} from './course-lifecycle.dto.js';

export type { CreateCourseVersionDto } from './create-course-version.dto.js';

export type { PublishCourseVersionDto } from './publish-course-version.dto.js';
