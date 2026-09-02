export {
  PrismaClient,
} from './generated/prisma/client.js';

export type {
  CourseModel,
} from './generated/prisma/models/Course.js';

export type {
  CourseVersionModel,
} from './generated/prisma/models/CourseVersion.js';

export type {
  CourseLevel,
  CourseType,
  CourseVisibility,
  CourseStatus,
  CourseVersionStatus,
} from './generated/prisma/enums.js';

export {
  createPrismaClient,
} from './lib/database.js';