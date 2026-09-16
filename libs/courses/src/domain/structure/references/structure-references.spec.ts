import { describe, expect, it } from 'vitest';

import { ContentId } from '../../content/identifiers/content-id.js';
import { CourseValidationError } from '../../errors/index.js';
import { AssessmentReferenceId } from '../identifiers/assessment-reference-id.js';
import { ContentItemReferenceId } from '../identifiers/content-item-reference-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';
import {
  createAssessmentReference,
  rehydrateAssessmentReference,
} from './assessment-reference.js';
import {
  createContentItemReference,
  rehydrateContentItemReference,
} from './content-item-reference.js';

const learningUnitId = LearningUnitId.from('learning-unit-001');

const contentId = ContentId.from('content-item-001');

const expectValidationIssue = (
  action: () => void,
  field: string,
  message: string,
  expectedErrorMessage?: string,
): void => {
  let error: unknown;

  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(CourseValidationError);

  if (!(error instanceof CourseValidationError)) {
    return;
  }

  if (expectedErrorMessage !== undefined) {
    expect(error.message).toBe(expectedErrorMessage);
  }

  expect(error.issues).toContainEqual({
    field,
    message,
  });
};

describe('ContentItemReference', () => {
  it('creates an immutable content reference', () => {
    const reference = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 1,
    });

    expect(reference.id).toBeInstanceOf(ContentItemReferenceId);

    expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);

    expect(reference.contentItemTargetId.equals(contentId)).toBe(true);

    expect(reference.position).toBe(1);
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it('generates distinct structural reference identities', () => {
    const first = createContentItemReference({
      learningUnitId,
      contentItemTargetId: ContentId.from('content-item-001'),
      position: 1,
    });

    const second = createContentItemReference({
      learningUnitId,
      contentItemTargetId: ContentId.from('content-item-002'),
      position: 2,
    });

    expect(first.id.equals(second.id)).toBe(false);
  });

  it('keeps structural reference identity separate from Content identity', () => {
    const first = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 1,
    });

    const second = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 2,
    });

    expect(first.contentItemTargetId.equals(second.contentItemTargetId)).toBe(
      true,
    );

    expect(first.id.equals(second.id)).toBe(false);
  });

  it('supports the same Content being referenced in different LearningUnits', () => {
    const first = createContentItemReference({
      learningUnitId: LearningUnitId.from('learning-unit-001'),
      contentItemTargetId: contentId,
      position: 1,
    });

    const second = createContentItemReference({
      learningUnitId: LearningUnitId.from('learning-unit-002'),
      contentItemTargetId: contentId,
      position: 1,
    });

    expect(first.contentItemTargetId.equals(second.contentItemTargetId)).toBe(
      true,
    );

    expect(first.learningUnitId.equals(second.learningUnitId)).toBe(false);
  });

  it('rejects a missing ContentId', () => {
    expectValidationIssue(
      () =>
        createContentItemReference({
          learningUnitId,
          contentItemTargetId: undefined as never,
          position: 1,
        }),
      'contentItemTargetId',
      'Content Item target identifier must be a ContentId.',
      'ContentItemReference target identifier is invalid.',
    );
  });

  it('rejects a string target identifier', () => {
    expectValidationIssue(
      () =>
        createContentItemReference({
          learningUnitId,
          contentItemTargetId: 'content-item-001' as never,
          position: 1,
        }),
      'contentItemTargetId',
      'Content Item target identifier must be a ContentId.',
      'ContentItemReference target identifier is invalid.',
    );
  });

  it('rejects an invalid position', () => {
    expectValidationIssue(
      () =>
        createContentItemReference({
          learningUnitId,
          contentItemTargetId: contentId,
          position: 0,
        }),
      'position',
      'Content Item reference position must be a positive integer.',
      'ContentItemReference position is invalid.',
    );
  });

  it('rejects a fractional position', () => {
    expectValidationIssue(
      () =>
        createContentItemReference({
          learningUnitId,
          contentItemTargetId: contentId,
          position: 1.5,
        }),
      'position',
      'Content Item reference position must be a positive integer.',
      'ContentItemReference position is invalid.',
    );
  });

  it('rehydrates without replacing either identity', () => {
    const referenceId = ContentItemReferenceId.from('content-ref-001');

    const reference = rehydrateContentItemReference({
      id: referenceId,
      learningUnitId,
      contentItemTargetId: contentId,
      position: 3,
    });

    expect(reference.id.equals(referenceId)).toBe(true);

    expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);

    expect(reference.contentItemTargetId.equals(contentId)).toBe(true);

    expect(reference.position).toBe(3);
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it('does not allow mutation through the returned object', () => {
    const reference = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 1,
    });

    expect(() => {
      (
        reference as {
          position: number;
        }
      ).position = 2;
    }).toThrow();

    expect(reference.position).toBe(1);
  });

  it('preserves the referenced ContentId during rehydration', () => {
    const reference = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 1,
    });

    const rehydrated = rehydrateContentItemReference(reference);

    expect(rehydrated.contentItemTargetId.equals(contentId)).toBe(true);

    expect(rehydrated.contentItemTargetId.toString()).toBe('content-item-001');
  });

  it('preserves the Content identity while creating a new structural reference identity', () => {
    const first = createContentItemReference({
      learningUnitId,
      contentItemTargetId: contentId,
      position: 1,
    });

    const rehydrated = rehydrateContentItemReference(first);

    expect(
      rehydrated.contentItemTargetId.equals(first.contentItemTargetId),
    ).toBe(true);

    expect(rehydrated.id.equals(first.id)).toBe(true);
  });
});

describe('AssessmentReference', () => {
  it('creates an immutable assessment reference', () => {
    const reference = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    expect(reference.id).toBeInstanceOf(AssessmentReferenceId);

    expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);

    expect(reference.assessmentTargetId).toBe('assessment-001');

    expect(reference.position).toBe(1);
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it('generates distinct structural reference identities', () => {
    const first = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    const second = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-002',
      position: 2,
    });

    expect(first.id.equals(second.id)).toBe(false);
  });

  it('keeps structural reference identity separate from target identity', () => {
    const first = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    const second = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 2,
    });

    expect(first.assessmentTargetId).toBe(second.assessmentTargetId);

    expect(first.id.equals(second.id)).toBe(false);
  });

  it('supports the same target being referenced in different LearningUnits', () => {
    const first = createAssessmentReference({
      learningUnitId: LearningUnitId.from('learning-unit-001'),
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    const second = createAssessmentReference({
      learningUnitId: LearningUnitId.from('learning-unit-002'),
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    expect(first.assessmentTargetId).toBe(second.assessmentTargetId);

    expect(first.learningUnitId.equals(second.learningUnitId)).toBe(false);
  });

  it('rejects an empty target identifier', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: '',
          position: 1,
        }),
      'assessmentTargetId',
      'Assessment target identifier must be a non-empty string.',
      'AssessmentReference target identifier is required.',
    );
  });

  it('rejects a whitespace-only target identifier', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: '   ',
          position: 1,
        }),
      'assessmentTargetId',
      'Assessment target identifier must be a non-empty string.',
      'AssessmentReference target identifier is required.',
    );
  });

  it('rejects a target identifier with leading whitespace', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: ' assessment-001',
          position: 1,
        }),
      'assessmentTargetId',
      'Assessment target identifier must not contain leading or trailing whitespace.',
      'AssessmentReference target identifier is invalid.',
    );
  });

  it('rejects a target identifier with trailing whitespace', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: 'assessment-001 ',
          position: 1,
        }),
      'assessmentTargetId',
      'Assessment target identifier must not contain leading or trailing whitespace.',
      'AssessmentReference target identifier is invalid.',
    );
  });

  it('rejects an invalid position', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: 'assessment-001',
          position: 0,
        }),
      'position',
      'Assessment reference position must be a positive integer.',
      'AssessmentReference position is invalid.',
    );
  });

  it('rejects a fractional position', () => {
    expectValidationIssue(
      () =>
        createAssessmentReference({
          learningUnitId,
          assessmentTargetId: 'assessment-001',
          position: 1.5,
        }),
      'position',
      'Assessment reference position must be a positive integer.',
      'AssessmentReference position is invalid.',
    );
  });

  it('rehydrates without replacing the reference identity', () => {
    const id = AssessmentReferenceId.from('assessment-ref-001');

    const reference = rehydrateAssessmentReference({
      id,
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 3,
    });

    expect(reference.id.equals(id)).toBe(true);

    expect(reference.learningUnitId.equals(learningUnitId)).toBe(true);

    expect(reference.assessmentTargetId).toBe('assessment-001');

    expect(reference.position).toBe(3);
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it('does not allow mutation through the returned object', () => {
    const reference = createAssessmentReference({
      learningUnitId,
      assessmentTargetId: 'assessment-001',
      position: 1,
    });

    expect(() => {
      (
        reference as {
          position: number;
        }
      ).position = 2;
    }).toThrow();

    expect(reference.position).toBe(1);
  });
});
