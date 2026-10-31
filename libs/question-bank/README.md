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

## Identity contract — Phase 5.14-A

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

## Explicitly deferred

The following remain outside Phase 5.14-B:

- Question versioning and change semantics — Phase 5.14-C
- Question validation and business invariants — Phase 5.14-D
- Persistence, repository, and indexing — Phase 5.14-E
- Application-service integration — Phase 5.14-F
- Full Question Bank regression and checkpoint — Phase 5.14-G

No Question aggregate, lifecycle, version identifier, tenant ownership
contract, authoring workflow, repository, database model, search index,
grading engine, or AI-generation policy is introduced by this phase.

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
