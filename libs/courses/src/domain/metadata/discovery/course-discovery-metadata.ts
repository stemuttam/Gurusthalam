import { AudienceReference } from './audience-reference.js';
import {
  createCourseDifficultySignals,
  type CourseDifficultySignals,
} from './difficulty-signals.js';
import {
  createFutureDiscoverySignal,
  type FutureDiscoverySignal,
} from './future-discovery-signal.js';
import { LanguageCode } from './language-code.js';
import {
  createLearningObjective,
  type LearningObjective,
} from './learning-objective.js';

/**
 * Discovery metadata owned by the Course domain.
 *
 * This contract captures deterministic, learner-facing discovery semantics
 * without introducing search indexes, embeddings, ranking scores,
 * recommendation decisions, model identifiers, or other intelligence
 * infrastructure concerns.
 *
 * The contract is intentionally suitable as a stable upstream input for
 * future search, knowledge-graph, recommendation, personalization, and
 * analytics projections.
 */
export interface CourseDiscoveryMetadata {
  readonly language: LanguageCode | null;
  readonly audience: readonly AudienceReference[];
  readonly difficulty: CourseDifficultySignals;
  readonly objectives: readonly LearningObjective[];
  readonly futureSignals: readonly FutureDiscoverySignal[];
}

/**
 * Input accepted by the discovery metadata factory.
 *
 * Collections are intentionally required and deterministic. An empty
 * collection means "no value supplied" and is distinct from an absent
 * property, which is not permitted by this domain contract.
 */
export interface CourseDiscoveryMetadataInput {
  readonly language: LanguageCode | null;
  readonly audience: readonly AudienceReference[];
  readonly difficulty: CourseDifficultySignals;
  readonly objectives: readonly LearningObjective[];
  readonly futureSignals: readonly FutureDiscoverySignal[];
}

/**
 * Creates a detached, deeply immutable discovery metadata snapshot.
 *
 * Runtime checks deliberately defend the domain boundary even when the
 * caller is TypeScript code. This protects the aggregate from malformed
 * JavaScript, deserialized data, tests using `unknown`, or future adapters.
 *
 * The factory reconstructs every mutable collection and every structural
 * discovery value so the returned snapshot does not retain caller-owned
 * mutable references.
 */
export function createCourseDiscoveryMetadata(
  input: CourseDiscoveryMetadataInput,
): CourseDiscoveryMetadata {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('CourseDiscoveryMetadata input must be an object.');
  }

  if (input.language !== null && !(input.language instanceof LanguageCode)) {
    throw new TypeError(
      'CourseDiscoveryMetadata.language must be a LanguageCode or null.',
    );
  }

  if (!Array.isArray(input.audience)) {
    throw new TypeError(
      'CourseDiscoveryMetadata.audience must be an array of AudienceReference values.',
    );
  }

  if (!Array.isArray(input.objectives)) {
    throw new TypeError(
      'CourseDiscoveryMetadata.objectives must be an array of LearningObjective values.',
    );
  }

  if (!Array.isArray(input.futureSignals)) {
    throw new TypeError(
      'CourseDiscoveryMetadata.futureSignals must be an array of FutureDiscoverySignal values.',
    );
  }

  const audience = input.audience.map((reference) => {
    if (!(reference instanceof AudienceReference)) {
      throw new TypeError(
        'CourseDiscoveryMetadata.audience must contain AudienceReference values.',
      );
    }

    return reference;
  });

  const objectives = input.objectives.map(createLearningObjective);
  const futureSignals = input.futureSignals.map(createFutureDiscoverySignal);

  return Object.freeze({
    language: input.language,
    audience: Object.freeze(audience),
    difficulty: createCourseDifficultySignals(input.difficulty),
    objectives: Object.freeze(objectives),
    futureSignals: Object.freeze(futureSignals),
  });
}
