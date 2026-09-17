export {
  PrismaClient,
  Prisma,
} from './generated/prisma/client.js';

export type {
  CourseModel,
} from './generated/prisma/models/Course.js';

export type {
  CourseOwnershipAssignmentModel,
} from './generated/prisma/models/CourseOwnershipAssignment.js';

export type {
  CourseVersionModel,
} from './generated/prisma/models/CourseVersion.js';

export type {
  CourseVersionAuditModel,
} from './generated/prisma/models/CourseVersionAudit.js';

export type {
  CourseVersionLineageModel,
} from './generated/prisma/models/CourseVersionLineage.js';

export type {
  CourseLevel,
  CourseOwnershipRole,
  CourseType,
  CourseVisibility,
  CourseStatus,
  CourseVersionStatus,
} from './generated/prisma/enums.js';

export {
  createPrismaClient,
} from './lib/database.js';