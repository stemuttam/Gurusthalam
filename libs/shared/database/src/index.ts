export { PrismaClient, Prisma } from './generated/prisma/client.js';

export type { CourseModel } from './generated/prisma/models/Course.js';

export type { CourseOwnershipAssignmentModel } from './generated/prisma/models/CourseOwnershipAssignment.js';

export type { CourseVersionModel } from './generated/prisma/models/CourseVersion.js';

export type { CourseVersionAuditModel } from './generated/prisma/models/CourseVersionAudit.js';

export type { CourseVersionLineageModel } from './generated/prisma/models/CourseVersionLineage.js';

export type { CourseCatalogProjectionModel } from './generated/prisma/models/CourseCatalogProjection.js';

export type { CourseSearchProjectionModel } from './generated/prisma/models/CourseSearchProjection.js';

export type { NotificationTemplateModel } from './generated/prisma/models/NotificationTemplate.js';

export type { NotificationTemplateVersionModel } from './generated/prisma/models/NotificationTemplateVersion.js';

export type { NotificationModel } from './generated/prisma/models/Notification.js';

export type { NotificationDeliveryModel } from './generated/prisma/models/NotificationDelivery.js';

export type { OutboxEventModel } from './generated/prisma/models/OutboxEvent.js';

export type { NotificationAggregationModel } from './generated/prisma/models/NotificationAggregation.js';

export type { NotificationAggregationItemModel } from './generated/prisma/models/NotificationAggregationItem.js';

export type { EnrollmentModel } from './generated/prisma/models/Enrollment.js';

export type {
  CourseLevel,
  CourseOwnershipRole,
  CourseType,
  CourseVisibility,
  CourseStatus,
  CourseVersionStatus,
  EnrollmentStatus,
  EnrollmentSource,
} from './generated/prisma/enums.js';

export { createPrismaClient } from './lib/database.js';
