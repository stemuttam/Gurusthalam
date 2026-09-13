import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CourseVersionAudit } from '../versioning/course-version-audit.js';
import { CourseId } from '../value-objects/course-id.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import type { CourseVersionAuditRepository } from './course-version-audit-repository.js';

describe('CourseVersionAuditRepository contract', () => {
  it(
    'accepts a persistence implementation matching the contract',
    async () => {
      const repository: CourseVersionAuditRepository = {
        async append(
          audit: CourseVersionAudit,
        ): Promise<void> {
          expect(audit).toBeDefined();
        },

        async findByCourseVersionId(
          courseVersionId: CourseVersionId,
        ): Promise<readonly CourseVersionAudit[]> {
          expect(
            courseVersionId,
          ).toBeInstanceOf(
            CourseVersionId,
          );

          return [];
        },

        async findByCourseId(
          courseId: string,
        ): Promise<readonly CourseVersionAudit[]> {
          expect(courseId).toBeTypeOf(
            'string',
          );

          return [];
        },
      };

      const courseId =
        CourseId.generate();

      const versionId =
        CourseVersionId.generate();

      expect(
        await repository.findByCourseVersionId(
          versionId,
        ),
      ).toEqual([]);

      expect(
        await repository.findByCourseId(
          courseId.value,
        ),
      ).toEqual([]);

      expect(
        repository.append,
      ).toBeTypeOf('function');
    },
  );
});