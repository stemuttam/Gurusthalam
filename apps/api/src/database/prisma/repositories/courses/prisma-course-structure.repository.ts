import {
  type CourseStructure,
  type CourseStructureRepository,
  type CourseVersionId,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { CourseStructurePrismaMapper } from '../../mappers/courses/index.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

const FIND_OPERATION = 'CourseStructureRepository.findByCourseVersionId';
const SAVE_OPERATION = 'CourseStructureRepository.save';

export class PrismaCourseStructureRepository implements CourseStructureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCourseVersionId(
    courseVersionId: CourseVersionId,
  ): Promise<CourseStructure | null> {
    return withPrismaRepositoryErrorBoundary(FIND_OPERATION, async () =>
      this.prisma.$transaction(
        async (transaction) => {
          const version = await transaction.courseVersion.findUnique({
            where: { id: courseVersionId.value },
            select: { id: true },
          });

          if (version === null) {
            return null;
          }

          const sections = await transaction.courseStructureSection.findMany({
            where: { courseVersionId: version.id },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
          });

          const sectionIds = sections.map(({ id }) => id);

          const learningUnits =
            sectionIds.length === 0
              ? []
              : await transaction.courseStructureLearningUnit.findMany({
                  where: { sectionId: { in: sectionIds } },
                  orderBy: [
                    { sectionId: 'asc' },
                    { position: 'asc' },
                    { id: 'asc' },
                  ],
                });

          const learningUnitIds = learningUnits.map(({ id }) => id);

          const contentItemReferences =
            learningUnitIds.length === 0
              ? []
              : await transaction.courseStructureContentItemReference.findMany({
                  where: { learningUnitId: { in: learningUnitIds } },
                  orderBy: [
                    { learningUnitId: 'asc' },
                    { position: 'asc' },
                    { id: 'asc' },
                  ],
                });

          const assessmentReferences =
            learningUnitIds.length === 0
              ? []
              : await transaction.courseStructureAssessmentReference.findMany({
                  where: { learningUnitId: { in: learningUnitIds } },
                  orderBy: [
                    { learningUnitId: 'asc' },
                    { position: 'asc' },
                    { id: 'asc' },
                  ],
                });

          return CourseStructurePrismaMapper.toDomain({
            courseVersionId: version.id,
            sections,
            learningUnits,
            contentItemReferences,
            assessmentReferences,
          });
        },
        { isolationLevel: 'RepeatableRead' },
      ),
    );
  }

  async save(structure: CourseStructure): Promise<void> {
    await withPrismaRepositoryErrorBoundary(SAVE_OPERATION, async () => {
      const snapshot = CourseStructurePrismaMapper.toPersistence(structure);

      await this.prisma.$transaction(
        async (transaction) => {
          const version = await transaction.courseVersion.findUnique({
            where: { id: snapshot.courseVersionId },
            select: { id: true },
          });

          if (version === null) {
            throw new PrismaRepositoryError(
              `Cannot save CourseStructure: CourseVersion "${snapshot.courseVersionId}" does not exist.`,
              PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
            );
          }

          // Replace this CourseVersion's structure atomically. Cascades remove
          // its structure children and references, not unrelated versions.
          // Existing progress/history records are intentionally not modified.
          await transaction.courseStructureSection.deleteMany({
            where: { courseVersionId: version.id },
          });

          // Prisma createMany expects mutable arrays. Convert each immutable
          // snapshot collection at this infrastructure boundary, preserving
          // every persisted value and the mapper's readonly contract.
          if (snapshot.sections.length > 0) {
            await transaction.courseStructureSection.createMany({
              data: snapshot.sections.map((record) => ({ ...record })),
            });
          }

          if (snapshot.learningUnits.length > 0) {
            await transaction.courseStructureLearningUnit.createMany({
              data: snapshot.learningUnits.map((record) => ({ ...record })),
            });
          }

          if (snapshot.contentItemReferences.length > 0) {
            await transaction.courseStructureContentItemReference.createMany({
              data: snapshot.contentItemReferences.map((record) => ({
                ...record,
              })),
            });
          }

          if (snapshot.assessmentReferences.length > 0) {
            await transaction.courseStructureAssessmentReference.createMany({
              data: snapshot.assessmentReferences.map((record) => ({
                ...record,
              })),
            });
          }
        },
        { isolationLevel: 'Serializable' },
      );
    });
  }
}
