# Gurusthalam Question Bank Domain

Package: `@gurusthalam/question-bank`

Nx tags:

- `scope:question-bank`
- `type:domain`

## Responsibility

The Question Bank bounded context owns the identity and future canonical
domain representation of reusable educational questions.

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

## Explicitly deferred

The following are outside Phase 5.14-A:

- Question types and answer formats — Phase 5.14-B
- Question versioning and change semantics — Phase 5.14-C
- Question validation and business invariants — Phase 5.14-D
- Persistence, repository, and indexing — Phase 5.14-E
- Application-service integration — Phase 5.14-F
- Full Question Bank regression and checkpoint — Phase 5.14-G

No Question aggregate, lifecycle, version identifier, tenant ownership
contract, authoring workflow, repository, database model, search index,
or AI-generation policy is introduced by this phase.

## Source-of-truth boundary

PostgreSQL remains the future transactional source of truth for persisted
Question Bank state.

Search indexes, vector stores, analytics, knowledge graphs, caches, and
AI-generated recommendations or content must not become authoritative
Question Bank state.
