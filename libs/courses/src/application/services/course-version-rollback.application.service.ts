import { randomUUID } from 'node:crypto';

import { CourseValidationError } from '../../domain/errors/index.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';

import {
  CourseVersionAudit,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
} from '../../domain/versioning/course-version-audit.js';

import { createCourseVersionRollback } from '../../domain/versioning/course-version-rollback.js';

import type {
  CourseVersionRollbackApplicationResult,
  CourseVersionRollbackApplicationService,
  CourseVersionRollbackInput,
  CourseVersionRollbackPersistence,
} from '../contracts/course-version-rollback.contracts.js';

import { courseVersionRollbackInputSchema } from '../contracts/course-version-rollback.validation.js';

export class DefaultCourseVersionRollbackApplicationService implements CourseVersionRollbackApplicationService {
  constructor(private readonly persistence: CourseVersionRollbackPersistence) {}

  async rollback(
    input: CourseVersionRollbackInput,
  ): Promise<CourseVersionRollbackApplicationResult> {
    const validatedInput = courseVersionRollbackInputSchema.parse(input);

    const courseId = CourseId.from(validatedInput.courseId);

    const sourceVersionId = CourseVersionId.from(
      validatedInput.sourceVersionId,
    );

    return this.persistence.execute(async (transaction) => {
      const source = await transaction.findVersionById(sourceVersionId);

      if (source === null) {
        throw new CourseValidationError(
          'CourseVersion rollback source was not found.',
          [
            {
              field: 'sourceVersionId',

              message:
                'The specified rollback source CourseVersion does not exist.',
            },
          ],
        );
      }

      if (source.courseId !== courseId.value) {
        throw new CourseValidationError(
          'CourseVersion rollback source does not belong to the specified Course.',
          [
            {
              field: 'sourceVersionId',

              message: 'The rollback source belongs to a different Course.',
            },
          ],
        );
      }

      const latest = await transaction.findLatestVersionByCourseId(courseId);

      const latestVersion = latest?.version ?? 0;

      const targetVersion = Math.max(source.version, latestVersion) + 1;

      const rollback = createCourseVersionRollback({
        source,

        targetVersion,

        reason: validatedInput.reason,
      });

      const audit = CourseVersionAudit.create({
        id: randomUUID(),

        version: rollback.version,

        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,

        actor: validatedInput.actor,

        reason: validatedInput.reason,

        metadata: {
          sourceVersionId: rollback.lineage.sourceVersionId.value,

          sourceVersion: rollback.lineage.sourceVersion,

          targetVersionId: rollback.lineage.targetVersionId.value,

          targetVersion: rollback.lineage.targetVersion,

          relation: rollback.lineage.relation,
        },
      });

      await transaction.saveVersion(rollback.version);

      await transaction.appendLineage(rollback.lineage);

      await transaction.appendAudit(audit);

      return Object.freeze({
        version: rollback.version,

        lineage: rollback.lineage,

        audit,
      });
    });
  }
}
