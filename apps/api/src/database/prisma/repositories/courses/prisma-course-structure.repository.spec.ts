import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContentId,
  CourseStructure,
  CourseVersionId,
  LearningUnit,
  LearningUnitId,
  Section,
  SectionId,
  createAssessmentReference,
  createContentItemReference,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { CourseStructurePrismaMapper } from '../../mappers/courses/course-structure-prisma.mapper.js';

import { PrismaRepositoryErrorCode } from '../prisma-repository.error.js';

import { PrismaCourseStructureRepository } from './prisma-course-structure.repository.js';

function createStructure(
  courseVersionIdValue = 'course-version-1',
): CourseStructure {
  const courseVersionId = CourseVersionId.from(courseVersionIdValue);
  const structure = CourseStructure.create({ courseVersionId });

  structure.addSection(
    Section.rehydrate({
      id: SectionId.from('section-1'),
      courseVersionId,
      title: 'Introduction',
      description: null,
      position: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );

  const section = structure.getSections()[0];

  if (section === undefined) {
    throw new Error('Expected a Section after adding it.');
  }

  structure.addLearningUnit(
    LearningUnit.rehydrate({
      id: LearningUnitId.from('unit-1'),
      sectionId: section.id,
      title: 'Welcome',
      description: 'Start here',
      position: 1,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }),
  );

  const unit = structure.getLearningUnits()[0];

  if (unit === undefined) {
    throw new Error('Expected a LearningUnit after adding it.');
  }

  structure.attachContentItemReference(
    createContentItemReference({
      learningUnitId: unit.id,
      contentItemTargetId: ContentId.from('content-target-1'),
      position: 1,
    }),
  );

  structure.attachAssessmentReference(
    createAssessmentReference({
      learningUnitId: unit.id,
      assessmentTargetId: 'assessment-target-1',
      position: 1,
    }),
  );

  return structure;
}

function createPrismaMock() {
  const courseVersionFindUnique = vi.fn();

  const sectionFindMany = vi.fn();
  const sectionDeleteMany = vi.fn();
  const sectionCreateMany = vi.fn();

  const learningUnitFindMany = vi.fn();
  const learningUnitCreateMany = vi.fn();

  const contentReferenceFindMany = vi.fn();
  const contentReferenceCreateMany = vi.fn();

  const assessmentReferenceFindMany = vi.fn();
  const assessmentReferenceCreateMany = vi.fn();

  const transactionClient = {
    courseVersion: {
      findUnique: courseVersionFindUnique,
    },
    courseStructureSection: {
      findMany: sectionFindMany,
      deleteMany: sectionDeleteMany,
      createMany: sectionCreateMany,
    },
    courseStructureLearningUnit: {
      findMany: learningUnitFindMany,
      createMany: learningUnitCreateMany,
    },
    courseStructureContentItemReference: {
      findMany: contentReferenceFindMany,
      createMany: contentReferenceCreateMany,
    },
    courseStructureAssessmentReference: {
      findMany: assessmentReferenceFindMany,
      createMany: assessmentReferenceCreateMany,
    },
  };

  const transaction = vi.fn();

  transaction.mockImplementation(
    async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );

  const prisma = {
    $transaction: transaction,
  } as unknown as PrismaClient;

  return {
    prisma,
    transaction,
    mocks: {
      courseVersionFindUnique,
      sectionFindMany,
      sectionDeleteMany,
      sectionCreateMany,
      learningUnitFindMany,
      learningUnitCreateMany,
      contentReferenceFindMany,
      contentReferenceCreateMany,
      assessmentReferenceFindMany,
      assessmentReferenceCreateMany,
    },
  };
}

describe('PrismaCourseStructureRepository', () => {
  let context: ReturnType<typeof createPrismaMock>;
  let repository: PrismaCourseStructureRepository;

  beforeEach(() => {
    context = createPrismaMock();
    repository = new PrismaCourseStructureRepository(context.prisma);
  });

  it('loads and rehydrates all structure nodes and references for one version', async () => {
    const structure = createStructure();
    const snapshot = CourseStructurePrismaMapper.toPersistence(structure);
    const { mocks } = context;

    mocks.courseVersionFindUnique.mockResolvedValue({
      id: snapshot.courseVersionId,
    });
    mocks.sectionFindMany.mockResolvedValue(snapshot.sections);
    mocks.learningUnitFindMany.mockResolvedValue(snapshot.learningUnits);
    mocks.contentReferenceFindMany.mockResolvedValue(
      snapshot.contentItemReferences,
    );
    mocks.assessmentReferenceFindMany.mockResolvedValue(
      snapshot.assessmentReferences,
    );

    const result = await repository.findByCourseVersionId(
      CourseVersionId.from(snapshot.courseVersionId),
    );

    expect(result).toBeInstanceOf(CourseStructure);
    expect(result?.courseVersionId.value).toBe(snapshot.courseVersionId);
    expect(result?.getSections().map((item) => item.id.value)).toEqual([
      'section-1',
    ]);
    expect(result?.getLearningUnits().map((item) => item.id.value)).toEqual([
      'unit-1',
    ]);
    expect(
      result?.getContentItemReferences().map((item) => item.id.value),
    ).toEqual(snapshot.contentItemReferences.map((item) => item.id));
    expect(
      result?.getAssessmentReferences().map((item) => item.id.value),
    ).toEqual(snapshot.assessmentReferences.map((item) => item.id));
    expect(mocks.sectionFindMany).toHaveBeenCalledWith({
      where: { courseVersionId: snapshot.courseVersionId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  });

  it('returns null when the CourseVersion does not exist', async () => {
    context.mocks.courseVersionFindUnique.mockResolvedValue(null);

    await expect(
      repository.findByCourseVersionId(CourseVersionId.from('missing-version')),
    ).resolves.toBeNull();

    expect(context.mocks.sectionFindMany).not.toHaveBeenCalled();
  });

  it('returns an empty structure when the version exists but has no Sections', async () => {
    context.mocks.courseVersionFindUnique.mockResolvedValue({
      id: 'empty-version',
    });
    context.mocks.sectionFindMany.mockResolvedValue([]);

    const result = await repository.findByCourseVersionId(
      CourseVersionId.from('empty-version'),
    );

    expect(result).toBeInstanceOf(CourseStructure);
    expect(result?.getSections()).toEqual([]);
    expect(result?.getLearningUnits()).toEqual([]);
    expect(context.mocks.learningUnitFindMany).not.toHaveBeenCalled();
  });

  it('saves every aggregate component in one transaction with stable identities', async () => {
    const structure = createStructure();
    const snapshot = CourseStructurePrismaMapper.toPersistence(structure);

    context.mocks.courseVersionFindUnique.mockResolvedValue({
      id: snapshot.courseVersionId,
    });
    context.mocks.sectionDeleteMany.mockResolvedValue({ count: 1 });
    context.mocks.sectionCreateMany.mockResolvedValue({
      count: snapshot.sections.length,
    });
    context.mocks.learningUnitCreateMany.mockResolvedValue({
      count: snapshot.learningUnits.length,
    });
    context.mocks.contentReferenceCreateMany.mockResolvedValue({
      count: snapshot.contentItemReferences.length,
    });
    context.mocks.assessmentReferenceCreateMany.mockResolvedValue({
      count: snapshot.assessmentReferences.length,
    });

    await expect(repository.save(structure)).resolves.toBeUndefined();

    expect(context.transaction).toHaveBeenCalledTimes(1);
    expect(context.mocks.sectionDeleteMany).toHaveBeenCalledWith({
      where: { courseVersionId: snapshot.courseVersionId },
    });
    expect(context.mocks.sectionCreateMany).toHaveBeenCalledWith({
      data: snapshot.sections,
    });
    expect(context.mocks.learningUnitCreateMany).toHaveBeenCalledWith({
      data: snapshot.learningUnits,
    });
    expect(context.mocks.contentReferenceCreateMany).toHaveBeenCalledWith({
      data: snapshot.contentItemReferences,
    });
    expect(context.mocks.assessmentReferenceCreateMany).toHaveBeenCalledWith({
      data: snapshot.assessmentReferences,
    });
  });

  it('persists an empty structure without creating child records', async () => {
    const structure = CourseStructure.create({
      courseVersionId: CourseVersionId.from('empty-version'),
    });

    context.mocks.courseVersionFindUnique.mockResolvedValue({
      id: 'empty-version',
    });
    context.mocks.sectionDeleteMany.mockResolvedValue({ count: 0 });

    await repository.save(structure);

    expect(context.mocks.sectionDeleteMany).toHaveBeenCalledWith({
      where: { courseVersionId: 'empty-version' },
    });
    expect(context.mocks.sectionCreateMany).not.toHaveBeenCalled();
    expect(context.mocks.learningUnitCreateMany).not.toHaveBeenCalled();
    expect(context.mocks.contentReferenceCreateMany).not.toHaveBeenCalled();
    expect(context.mocks.assessmentReferenceCreateMany).not.toHaveBeenCalled();
  });

  it('rejects saving a structure for a missing CourseVersion', async () => {
    context.mocks.courseVersionFindUnique.mockResolvedValue(null);

    await expect(
      repository.save(
        CourseStructure.create({
          courseVersionId: CourseVersionId.from('missing-version'),
        }),
      ),
    ).rejects.toMatchObject({
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
    });

    expect(context.mocks.sectionDeleteMany).not.toHaveBeenCalled();
  });

  it('propagates a child persistence failure so the database transaction can roll back', async () => {
    const structure = createStructure();

    context.mocks.courseVersionFindUnique.mockResolvedValue({
      id: structure.courseVersionId.value,
    });
    context.mocks.sectionDeleteMany.mockResolvedValue({ count: 1 });
    context.mocks.sectionCreateMany.mockResolvedValue({ count: 1 });
    context.mocks.learningUnitCreateMany.mockRejectedValue(
      new Error('Simulated LearningUnit persistence failure'),
    );

    await expect(repository.save(structure)).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
    });

    expect(context.transaction).toHaveBeenCalledTimes(1);
  });
});
