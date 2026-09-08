import { describe, expect, it } from 'vitest';

import { AudienceReference } from './audience-reference.js';
import {
  createCourseDifficultySignals,
  type CourseDifficultySignals,
  type DifficultyDimension,
  type DifficultySignalStrength,
} from './difficulty-signals.js';
import {
  createFutureDiscoverySignal,
  type FutureDiscoverySignal,
} from './future-discovery-signal.js';
import {
  createLearningObjective,
  type LearningObjective,
} from './learning-objective.js';
import { LanguageCode } from './language-code.js';
import {
  createCourseDiscoveryMetadata,
  } from './course-discovery-metadata.js';

describe('LanguageCode', () => {
  it('creates a valid language code', () => {
    const language = LanguageCode.from('en');

    expect(language.value).toBe('en');
    expect(language.toString()).toBe('en');
  });

  it('supports language tags with subtags', () => {
    expect(LanguageCode.from('en-US').value).toBe('en-US');
    expect(LanguageCode.from('hi-IN').value).toBe('hi-IN');
  });

  it('rejects invalid language codes', () => {
    expect(() => LanguageCode.from('')).toThrow(TypeError);
    expect(() => LanguageCode.from(' en')).toThrow(TypeError);
    expect(() => LanguageCode.from('en ')).toThrow(TypeError);
    expect(() => LanguageCode.from('english')).toThrow(TypeError);
  });

  it('reports primitive validity correctly', () => {
    expect(LanguageCode.isValid('en')).toBe(true);
    expect(LanguageCode.isValid('en-US')).toBe(true);
    expect(LanguageCode.isValid('hi-IN')).toBe(true);
    expect(LanguageCode.isValid('')).toBe(false);
    expect(LanguageCode.isValid(' en')).toBe(false);
    expect(LanguageCode.isValid('en ')).toBe(false);
    expect(LanguageCode.isValid('english')).toBe(false);
    expect(LanguageCode.isValid(null)).toBe(false);
    expect(LanguageCode.isValid(undefined)).toBe(false);
    expect(LanguageCode.isValid(123)).toBe(false);
  });

  it('supports equality', () => {
    expect(LanguageCode.from('en').equals(LanguageCode.from('en'))).toBe(
      true,
    );

    expect(LanguageCode.from('en').equals(LanguageCode.from('hi'))).toBe(
      false,
    );
  });

  it('is immutable', () => {
    const language = LanguageCode.from('en');

    expect(Object.isFrozen(language)).toBe(true);
  });
});

describe('AudienceReference', () => {
  it('creates a valid audience reference', () => {
    const audience = AudienceReference.from('secondary-school-students');

    expect(audience.value).toBe('secondary-school-students');
  });

  it('rejects invalid audience references', () => {
    expect(() => AudienceReference.from('')).toThrow(TypeError);
    expect(() => AudienceReference.from(' ')).toThrow(TypeError);
    expect(() => AudienceReference.from(' learner')).toThrow(TypeError);
    expect(() => AudienceReference.from('learner ')).toThrow(TypeError);
  });

  it('reports primitive validity correctly', () => {
    expect(AudienceReference.isValid('teachers')).toBe(true);
    expect(AudienceReference.isValid('')).toBe(false);
    expect(AudienceReference.isValid('   ')).toBe(false);
    expect(AudienceReference.isValid(' learner')).toBe(false);
    expect(AudienceReference.isValid('learner ')).toBe(false);
    expect(AudienceReference.isValid(null)).toBe(false);
    expect(AudienceReference.isValid(undefined)).toBe(false);
    expect(AudienceReference.isValid(123)).toBe(false);
  });

  it('supports equality', () => {
    expect(
      AudienceReference.from('teachers').equals(
        AudienceReference.from('teachers'),
      ),
    ).toBe(true);

    expect(
      AudienceReference.from('teachers').equals(
        AudienceReference.from('students'),
      ),
    ).toBe(false);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(AudienceReference.from('teachers'))).toBe(true);
  });
});

describe('CourseDifficultySignals', () => {
  it('creates structured difficulty signals', () => {
    const difficulty = createCourseDifficultySignals({
      signals: [
        {
          dimension: 'conceptual',
          strength: 'high',
        },
        {
          dimension: 'workload',
          strength: 'moderate',
        },
      ],
    });

    expect(difficulty.signals).toHaveLength(2);
    expect(difficulty.signals[0]?.dimension).toBe('conceptual');
    expect(difficulty.signals[1]?.strength).toBe('moderate');
  });

  it('rejects invalid dimensions at runtime', () => {
    expect(() =>
      createCourseDifficultySignals({
        signals: [
          {
            dimension: 'invalid' as unknown as DifficultyDimension,
            strength: 'high',
          },
        ],
      }),
    ).toThrow(TypeError);
  });

  it('rejects invalid strengths at runtime', () => {
    expect(() =>
      createCourseDifficultySignals({
        signals: [
          {
            dimension: 'conceptual',
            strength: 'extreme' as unknown as DifficultySignalStrength,
          },
        ],
      }),
    ).toThrow(TypeError);
  });

  it('rejects duplicate dimensions', () => {
    expect(() =>
      createCourseDifficultySignals({
        signals: [
          {
            dimension: 'pace',
            strength: 'low',
          },
          {
            dimension: 'pace',
            strength: 'high',
          },
        ],
      }),
    ).toThrow(TypeError);
  });

  it('rejects a non-array signal collection at runtime', () => {
    expect(() =>
      createCourseDifficultySignals({
        signals: 'invalid' as unknown as CourseDifficultySignals['signals'],
      }),
    ).toThrow(TypeError);
  });

  it('creates immutable detached values', () => {
    const input: CourseDifficultySignals = {
      signals: [
        {
          dimension: 'prerequisite',
          strength: 'moderate',
        },
      ],
    };

    const result = createCourseDifficultySignals(input);

    expect(result).not.toBe(input);
    expect(result.signals).not.toBe(input.signals);
    expect(result.signals[0]).not.toBe(input.signals[0]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.signals)).toBe(true);
    expect(Object.isFrozen(result.signals[0])).toBe(true);
  });
});

describe('LearningObjective', () => {
  it('creates a valid learning objective', () => {
    const objective = createLearningObjective({
      statement: 'Explain the fundamental principles of algebra.',
    });

    expect(objective.statement).toBe(
      'Explain the fundamental principles of algebra.',
    );
  });

  it('rejects malformed input at runtime', () => {
    expect(() =>
      createLearningObjective(null as unknown as LearningObjective),
    ).toThrow(TypeError);
  });

  it('rejects blank objectives', () => {
    expect(() =>
      createLearningObjective({
        statement: '',
      }),
    ).toThrow(TypeError);

    expect(() =>
      createLearningObjective({
        statement: ' ',
      }),
    ).toThrow(TypeError);

    expect(() =>
      createLearningObjective({
        statement: ' Solve equations.',
      }),
    ).toThrow(TypeError);

    expect(() =>
      createLearningObjective({
        statement: 'Solve equations. ',
      }),
    ).toThrow(TypeError);
  });

  it('is immutable', () => {
    const objective = createLearningObjective({
      statement: 'Solve linear equations.',
    });

    expect(Object.isFrozen(objective)).toBe(true);
  });
});

describe('FutureDiscoverySignal', () => {
  it('creates a namespaced discovery signal', () => {
    const signal = createFutureDiscoverySignal({
      key: 'discovery.search-intent',
      values: ['algebra fundamentals', 'linear equations'],
    });

    expect(signal.key).toBe('discovery.search-intent');
    expect(signal.values).toEqual([
      'algebra fundamentals',
      'linear equations',
    ]);
  });

  it('rejects invalid keys', () => {
    expect(() =>
      createFutureDiscoverySignal({
        key: '',
        values: ['algebra'],
      }),
    ).toThrow(TypeError);

    expect(() =>
      createFutureDiscoverySignal({
        key: 'Discovery Signal',
        values: ['algebra'],
      }),
    ).toThrow(TypeError);
  });

  it('rejects invalid values', () => {
    expect(() =>
      createFutureDiscoverySignal({
        key: 'discovery.keyword',
        values: [''],
      }),
    ).toThrow(TypeError);
  });

  it('rejects a non-array value collection at runtime', () => {
    expect(() =>
      createFutureDiscoverySignal({
        key: 'discovery.keyword',
        values: 'algebra' as unknown as readonly string[],
      }),
    ).toThrow(TypeError);
  });

  it('creates detached immutable values', () => {
    const input: FutureDiscoverySignal = {
      key: 'discovery.keyword',
      values: ['algebra'],
    };

    const result = createFutureDiscoverySignal(input);

    expect(result).not.toBe(input);
    expect(result.values).not.toBe(input.values);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.values)).toBe(true);
  });
});

describe('CourseDiscoveryMetadata', () => {
  it('creates complete discovery metadata', () => {
    const difficulty: CourseDifficultySignals = {
      signals: [
        {
          dimension: 'conceptual',
          strength: 'moderate',
        },
      ],
    };

    const objective: LearningObjective = {
      statement: 'Understand quadratic equations.',
    };

    const metadata = createCourseDiscoveryMetadata({
      language: LanguageCode.from('en'),
      audience: [
        AudienceReference.from('secondary-school-students'),
        AudienceReference.from('exam-preparation'),
      ],
      difficulty,
      objectives: [objective],
      futureSignals: [
        {
          key: 'discovery.keyword',
          values: ['quadratic equations'],
        },
      ],
    });

    expect(metadata.language?.value).toBe('en');
    expect(metadata.audience).toHaveLength(2);
    expect(metadata.difficulty.signals).toHaveLength(1);
    expect(metadata.objectives[0]?.statement).toBe(
      'Understand quadratic equations.',
    );
    expect(metadata.futureSignals[0]?.key).toBe('discovery.keyword');
  });

  it('rejects a non-LanguageCode runtime value', () => {
    expect(() =>
      createCourseDiscoveryMetadata({
        language: { value: 'en' } as unknown as LanguageCode,
        audience: [],
        difficulty: { signals: [] },
        objectives: [],
        futureSignals: [],
      }),
    ).toThrow(TypeError);
  });

  it('rejects non-reference audience values at runtime', () => {
    expect(() =>
      createCourseDiscoveryMetadata({
        language: null,
        audience: ['students'] as unknown as readonly AudienceReference[],
        difficulty: { signals: [] },
        objectives: [],
        futureSignals: [],
      }),
    ).toThrow(TypeError);
  });

  it('rejects non-array discovery collections at runtime', () => {
    expect(() =>
      createCourseDiscoveryMetadata({
        language: null,
        audience: 'students' as unknown as readonly AudienceReference[],
        difficulty: { signals: [] },
        objectives: [],
        futureSignals: [],
      }),
    ).toThrow(TypeError);

    expect(() =>
      createCourseDiscoveryMetadata({
        language: null,
        audience: [],
        difficulty: { signals: [] },
        objectives: 'objective' as unknown as readonly LearningObjective[],
        futureSignals: [],
      }),
    ).toThrow(TypeError);

    expect(() =>
      createCourseDiscoveryMetadata({
        language: null,
        audience: [],
        difficulty: { signals: [] },
        objectives: [],
        futureSignals: 'signal' as unknown as readonly FutureDiscoverySignal[],
      }),
    ).toThrow(TypeError);
  });

  it('creates a detached immutable aggregate', () => {
    const audience = [AudienceReference.from('secondary-school-students')];
    const objectives: LearningObjective[] = [
      { statement: 'Understand quadratic equations.' },
    ];
    const futureSignals: FutureDiscoverySignal[] = [
      {
        key: 'discovery.keyword',
        values: ['quadratic equations'],
      },
    ];
    const difficulty: CourseDifficultySignals = {
      signals: [
        {
          dimension: 'conceptual',
          strength: 'moderate',
        },
      ],
    };

    const metadata = createCourseDiscoveryMetadata({
      language: LanguageCode.from('en'),
      audience,
      difficulty,
      objectives,
      futureSignals,
    });

    expect(metadata.audience).not.toBe(audience);
    expect(metadata.difficulty).not.toBe(difficulty);
    expect(metadata.objectives).not.toBe(objectives);
    expect(metadata.futureSignals).not.toBe(futureSignals);
    expect(metadata.difficulty.signals[0]).not.toBe(difficulty.signals[0]);
    expect(metadata.objectives[0]).not.toBe(objectives[0]);
    expect(metadata.futureSignals[0]).not.toBe(futureSignals[0]);

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.audience)).toBe(true);
    expect(Object.isFrozen(metadata.difficulty)).toBe(true);
    expect(Object.isFrozen(metadata.difficulty.signals)).toBe(true);
    expect(Object.isFrozen(metadata.difficulty.signals[0])).toBe(true);
    expect(Object.isFrozen(metadata.objectives)).toBe(true);
    expect(Object.isFrozen(metadata.objectives[0])).toBe(true);
    expect(Object.isFrozen(metadata.futureSignals)).toBe(true);
    expect(Object.isFrozen(metadata.futureSignals[0])).toBe(true);
    expect(Object.isFrozen(metadata.futureSignals[0]?.values)).toBe(true);
  });

  it('supports an empty discovery profile', () => {
    const metadata = createCourseDiscoveryMetadata({
      language: null,
      audience: [],
      difficulty: { signals: [] },
      objectives: [],
      futureSignals: [],
    });

    expect(metadata.language).toBeNull();
    expect(metadata.audience).toEqual([]);
    expect(metadata.difficulty.signals).toEqual([]);
    expect(metadata.objectives).toEqual([]);
    expect(metadata.futureSignals).toEqual([]);
  });
});
