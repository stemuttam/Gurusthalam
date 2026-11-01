# Gurusthalam Question Bank Domain

Package: `@gurusthalam/question-bank`

Nx tags:

- `scope:question-bank`
- `type:domain`

## Responsibility

The Question Bank bounded context owns the identity and canonical domain
contracts for reusable educational questions.

It is separate from:

- Assessment
- Course Structure
- Quiz
- Assignment
- Exam
- Attempt
- Answer
- Grading
- Assessment Result

These contexts may refer to questions through explicit contracts, but they
must not take ownership of Question Bank state.

## Question identity contract — Phase 5.14-A

`QuestionId` identifies one Question domain entity.

Its rules are:

1. New identifiers are generated using UUIDs.
2. Existing identifiers are treated as opaque canonical strings.
3. UUID syntax is not required when rehydrating an existing identifier.
4. Empty and whitespace-only identifiers are rejected.
5. Leading or trailing whitespace is rejected; values are never silently
   normalized.
6. Equality is based on the primitive identifier value.
7. Identifier instances are immutable.
8. Persistence-specific identifier representations do not leak into the
   domain package.

`QuestionId` is not interchangeable with `AssessmentId`,
`AssessmentReferenceId`, or identifiers belonging to other bounded contexts.

## Question types and answer formats — Phase 5.14-B

A question type describes the structure of an educational question.

An answer format describes the structure of the learner's response.

These are separate domain concepts. A question type does not implicitly
define its answer representation; the compatibility contract explicitly
defines supported combinations.

### Supported question types

| Question type       | Description                                     |
| ------------------- | ----------------------------------------------- |
| `SINGLE_CHOICE`     | Learner selects one option                      |
| `MULTIPLE_CHOICE`   | Learner selects multiple options                |
| `TRUE_FALSE`        | Learner provides a boolean response             |
| `SHORT_ANSWER`      | Learner provides a short text response          |
| `LONG_ANSWER`       | Learner provides a long text response           |
| `NUMERIC`           | Learner provides a numeric response             |
| `MATCHING`          | Learner provides a collection of matching pairs |
| `ORDERING`          | Learner provides an ordered collection of items |
| `FILL_IN_THE_BLANK` | Learner provides responses for blanks           |

### Supported answer formats

| Answer format      | Response representation          |
| ------------------ | -------------------------------- |
| `SELECTED_OPTION`  | One selected option              |
| `SELECTED_OPTIONS` | A collection of selected options |
| `BOOLEAN`          | A boolean value                  |
| `SHORT_TEXT`       | Short text                       |
| `LONG_TEXT`        | Long text                        |
| `NUMBER`           | A numeric value                  |
| `MATCHING_PAIRS`   | A collection of matching pairs   |
| `ORDERED_ITEMS`    | An ordered collection of items   |
| `BLANK_RESPONSES`  | A collection of blank responses  |

### Compatibility contract

| Question type       | Supported answer format |
| ------------------- | ----------------------- |
| `SINGLE_CHOICE`     | `SELECTED_OPTION`       |
| `MULTIPLE_CHOICE`   | `SELECTED_OPTIONS`      |
| `TRUE_FALSE`        | `BOOLEAN`               |
| `SHORT_ANSWER`      | `SHORT_TEXT`            |
| `LONG_ANSWER`       | `LONG_TEXT`             |
| `NUMERIC`           | `NUMBER`                |
| `MATCHING`          | `MATCHING_PAIRS`        |
| `ORDERING`          | `ORDERED_ITEMS`         |
| `FILL_IN_THE_BLANK` | `BLANK_RESPONSES`       |

The public domain API provides:

- `QuestionType`
- `QUESTION_TYPES`
- `isQuestionType`
- `AnswerFormat`
- `ANSWER_FORMATS`
- `isAnswerFormat`
- `QUESTION_ANSWER_COMPATIBILITY`
- `getSupportedAnswerFormats`
- `isSupportedAnswerFormat`

The compatibility contract defines supported combinations only. It does
not implement response validation, correctness evaluation, grading,
scoring, or answer persistence.

Adding a new question type or answer format requires an intentional
domain-contract change and corresponding compatibility and regression
tests.

## Question versioning and change semantics — Phase 5.14-C

Question identity and Question version identity are separate concepts.

### QuestionId

`QuestionId` identifies the stable Question entity across its entire
revision history.

Revising a question does not change its `QuestionId`.

### QuestionVersionId

`QuestionVersionId` identifies one specific Question revision.

Its rules are:

1. New version identifiers are generated using UUIDs.
2. Existing version identifiers are treated as opaque canonical strings.
3. UUID syntax is not required when rehydrating an existing identifier.
4. Empty and whitespace-only identifiers are rejected.
5. Leading or trailing whitespace is rejected; values are never silently
   normalized.
6. Equality is based on the primitive identifier value.
7. Identifier instances are immutable.
8. A version identifier does not encode version ordering.
9. A `QuestionVersionId` is distinct from a `QuestionId`.

### QuestionVersionNumber

`QuestionVersionNumber` represents the sequential revision number within
one owning Question.

Its rules are:

1. The initial version number is `1`.
2. Version numbers must be positive safe integers.
3. Fractional, zero, negative, non-finite, and unsafe integer values are
   rejected.
4. Numeric values are never coerced, rounded, or truncated.
5. The `next()` operation returns a new value exactly one greater than
   the current value.
6. Advancing beyond `Number.MAX_SAFE_INTEGER` is rejected.
7. Version numbers are not globally unique.
8. A version number must be interpreted together with its owning
   `QuestionId`.

The value object validates a version number and provides safe sequential
advancement. Enforcing the next sequential version for a particular
Question belongs to the Question-level domain operation.

### QuestionVersionReference

`QuestionVersionReference` represents immutable identity and ownership
metadata for an existing question version.

It contains:

- `id`: the `QuestionVersionId` identifying the version.
- `questionId`: the stable `QuestionId` owning the version.
- `versionNumber`: the `QuestionVersionNumber` identifying its position
  in that Question's revision history.

Its rules are:

1. All three identity and ownership values must be valid domain value
   objects.
2. A version reference cannot be created with an invalid identifier,
   owner, or version number.
3. Equality considers the version ID, Question ID, and version number.
4. Reference instances are immutable.
5. A reference contains metadata only; it is not a complete
   `QuestionVersion` entity or content snapshot.

### QuestionVersionLineage

`QuestionVersionLineage` describes the chronological predecessor and
historical restoration relationships for one question version.

It contains:

- `currentVersion`: the version whose lineage is being described.
- `previousVersion`: the immediate chronological predecessor, or `null`
  for the initial version.
- `restoredFromVersion`: the historical version used as the source of a
  restoration, or `null` for an ordinary revision.

#### Immediate predecessor

The `previousVersion` relationship represents chronological revision
history.

Its rules are:

1. Version 1 has no predecessor.
2. Every version after version 1 must have an immediate predecessor.
3. The predecessor must belong to the same Question.
4. The predecessor's version number must be exactly one less than the
   current version number.
5. A version cannot be its own predecessor.
6. The predecessor relationship is independent of restoration provenance.

#### Historical restoration source

The `restoredFromVersion` relationship identifies the historical version
whose content is used as the source for a restoration revision.

Its rules are:

1. An ordinary revision has no restoration source.
2. A restoration source must belong to the same Question.
3. A restoration source must represent an earlier version.
4. A version cannot be restored from itself.
5. The restoration source need not be the immediate predecessor.
6. The restoration source does not replace or modify the predecessor
   relationship.
7. The same version may be both the immediate predecessor and the
   restoration source.
8. References identifying the same version must have consistent
   identity and ownership metadata.
9. Different version identities cannot claim the same version number
   within the same Question when compared by the lineage contract.

#### Example

A Question has the following revision history:

| Version | Immediate predecessor | Restoration source |
| ------- | --------------------- | ------------------ |
| 1       | None                  | None               |
| 2       | Version 1             | None               |
| 3       | Version 2             | None               |
| 4       | Version 3             | Version 1          |

Version 4 is chronologically derived from version 3, while its
restoration provenance identifies version 1.

The chronological chain remains intact. Restoration provenance is a
separate relationship.

#### Lineage validation boundary

`QuestionVersionLineage` validates the references supplied to it and
their locally observable ownership and ordering relationships.

It cannot independently establish:

- That a referenced historical version exists in persistent storage.
- That all version numbers across the complete Question history are
  unique.
- That the supplied predecessor or restoration source has been
  persisted.
- That a restoration operation actually copied historical content.

Those checks require the future Question-level history, aggregate,
application-service, and persistence contracts.

### Identity and ordering separation

The versioning contracts have distinct responsibilities:

| Contract                   | Responsibility                                       |
| -------------------------- | ---------------------------------------------------- |
| `QuestionId`               | Stable identity of the Question entity               |
| `QuestionVersionId`        | Identity of one specific Question revision           |
| `QuestionVersionNumber`    | Sequential ordering of revisions within one Question |
| `QuestionVersionReference` | Immutable version identity and ownership metadata    |
| `QuestionVersionLineage`   | Immediate predecessor and restoration relationships  |

A version number is not a substitute for a version identifier. A version
identifier is not a substitute for the owning Question identity.

### Approved revision direction

The approved versioning direction is:

1. Initial Question creation starts at version number `1`.
2. A revision retains the same `QuestionId`.
3. A revision receives a new `QuestionVersionId`.
4. A revision receives the next sequential version number for that Question.
5. Historical versions remain independently identifiable.
6. Existing historical versions are not modified to represent later changes.
7. Restoring historical content creates a new revision rather than
   mutating an earlier version.
8. A later revision identifies its immediate predecessor.
9. A restoration revision separately identifies its historical restoration
   source.
10. A version must belong to its owning Question; cross-Question version
    assignment is invalid.

The current implementation establishes immutable identity, ownership,
ordering metadata, and local lineage relationships. It does not yet
implement a complete Question aggregate or revision operation.

### Public API

The Question Bank public API exposes the following versioning contracts:

- `QuestionVersionId`
- `QuestionVersionNumber`
- `QuestionVersionReference`
- `QuestionVersionLineage`

The public API contract tests verify that the version identity, version
number, reference, and lineage contracts are accessible through the
package entry point.

### Explicitly not introduced by Phase 5.14-C

This phase does not introduce:

- A complete Question aggregate.
- A complete `QuestionVersion` entity or immutable content snapshot.
- Question content fields or a generic content payload.
- Question lifecycle or publication workflow.
- Revision application services.
- Historical restoration execution or content copying.
- Persistence models, repositories, or migrations.
- Tenant ownership or authorization rules.
- Search indexing or version projections.
- Persistent existence verification for predecessor or restoration
  references.

Those contracts require their own explicit design and validation. They
must not be inferred from the identity, number, reference, or lineage
contracts.

## Explicitly deferred beyond Phase 5.14-C

The following remain outside this implementation step:

- Question validation and business invariants — Phase 5.14-D
- Persistence, repository, and indexing — Phase 5.14-E
- Application-service integration — Phase 5.14-F
- Full Question Bank regression and checkpoint — Phase 5.14-G

Specialized response types such as file uploads, code execution, audio,
and video are not included in the approved initial taxonomy.

## Source-of-truth boundary

PostgreSQL remains the future transactional source of truth for persisted
Question Bank state.

Search indexes, vector stores, analytics, knowledge graphs, caches, and
AI-generated recommendations or content must not become authoritative
Question Bank state.

## Domain dependency boundary

The Question Bank domain remains independent of infrastructure concerns.

It must not depend on:

- Prisma
- NestJS
- BullMQ
- Redis
- TypeORM
- Drizzle
- Firebase
- Kafka
- Cloud provider SDKs
- Transport or delivery frameworks

Infrastructure integrations belong in their appropriate outer layers.
