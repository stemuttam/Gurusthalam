import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  CourseVersionLineage,
} from '../versioning/course-version-lineage.js';

import {
  CourseVersionId,
} from '../value-objects/course-version-id.js';

import type {
  CourseVersionLineageRepository,
} from './course-version-lineage-repository.js';

describe(
  'CourseVersionLineageRepository contract',
  () => {
    it(
      'accepts a persistence implementation matching the contract',
      async () => {
        const sourceVersionId =
          CourseVersionId.generate();

        const targetVersionId =
          CourseVersionId.generate();

        const repository: CourseVersionLineageRepository =
          {
            async append(
              lineage: CourseVersionLineage,
            ): Promise<void> {
              expect(
                lineage,
              ).toBeDefined();
            },

            async findBySourceVersionId(
              id: CourseVersionId,
            ): Promise<
              readonly CourseVersionLineage[]
            > {
              expect(
                id,
              ).toBeInstanceOf(
                CourseVersionId,
              );

              return [];
            },

            async findByTargetVersionId(
              id: CourseVersionId,
            ): Promise<
              readonly CourseVersionLineage[]
            > {
              expect(
                id,
              ).toBeInstanceOf(
                CourseVersionId,
              );

              return [];
            },

            async findByCourseId(
              courseId: string,
            ): Promise<
              readonly CourseVersionLineage[]
            > {
              expect(
                courseId,
              ).toBeTypeOf(
                'string',
              );

              return [];
            },
          };

        await repository.append(
          {} as CourseVersionLineage,
        );

        expect(
          await repository.findBySourceVersionId(
            sourceVersionId,
          ),
        ).toEqual(
          [],
        );

        expect(
          await repository.findByTargetVersionId(
            targetVersionId,
          ),
        ).toEqual(
          [],
        );

        expect(
          await repository.findByCourseId(
            'course-001',
          ),
        ).toEqual(
          [],
        );

        expect(
          repository.append,
        ).toBeTypeOf(
          'function',
        );

        expect(
          repository.findBySourceVersionId,
        ).toBeTypeOf(
          'function',
        );

        expect(
          repository.findByTargetVersionId,
        ).toBeTypeOf(
          'function',
        );

        expect(
          repository.findByCourseId,
        ).toBeTypeOf(
          'function',
        );
      },
    );
  },
);