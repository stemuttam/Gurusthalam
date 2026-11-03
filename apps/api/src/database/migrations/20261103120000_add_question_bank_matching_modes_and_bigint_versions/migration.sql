-- Phase 5.14-E-C follow-up: explicit matching cardinality and BIGINT version numbers.
-- The already-applied initial Question Bank migration is intentionally unchanged.

CREATE TYPE "QuestionBankMatchingMode" AS ENUM ('ONE_TO_ONE', 'MANY_TO_ONE');

ALTER TABLE "QuestionVersionContent"
  ADD COLUMN "matchingMode" "QuestionBankMatchingMode";

ALTER TABLE "QuestionVersion"
  ALTER COLUMN "versionNumber" TYPE BIGINT
  USING "versionNumber"::BIGINT;

CREATE OR REPLACE FUNCTION "question_version_lineage_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  latest_number BIGINT;
  previous_number BIGINT;
  restored_number BIGINT;
BEGIN
  PERFORM 1 FROM "Question" WHERE "id" = NEW."questionId" FOR UPDATE;

  IF NEW."versionNumber" = 1 THEN
    IF NEW."previousVersionId" IS NOT NULL THEN
      RAISE EXCEPTION 'Initial QuestionVersion cannot have a predecessor';
    END IF;
    IF NEW."restoredFromVersionId" IS NOT NULL THEN
      RAISE EXCEPTION 'Initial QuestionVersion cannot restore an earlier version';
    END IF;
    SELECT MAX("versionNumber") INTO latest_number
      FROM "QuestionVersion" WHERE "questionId" = NEW."questionId";
    IF latest_number IS NOT NULL THEN
      RAISE EXCEPTION 'Initial QuestionVersion must be the first version';
    END IF;
  ELSE
    IF NEW."previousVersionId" IS NULL THEN
      RAISE EXCEPTION 'Non-initial QuestionVersion requires its immediate predecessor';
    END IF;

    SELECT "versionNumber" INTO previous_number
      FROM "QuestionVersion"
      WHERE "id" = NEW."previousVersionId"
        AND "questionId" = NEW."questionId";

    IF previous_number IS NULL OR previous_number <> NEW."versionNumber" - 1 THEN
      RAISE EXCEPTION 'QuestionVersion predecessor must be the immediately preceding version';
    END IF;

    SELECT MAX("versionNumber") INTO latest_number
      FROM "QuestionVersion" WHERE "questionId" = NEW."questionId";
    IF latest_number IS DISTINCT FROM NEW."versionNumber" - 1 THEN
      RAISE EXCEPTION 'QuestionVersion numbers must be created sequentially';
    END IF;

    IF NEW."restoredFromVersionId" IS NOT NULL THEN
      SELECT "versionNumber" INTO restored_number
        FROM "QuestionVersion"
        WHERE "id" = NEW."restoredFromVersionId"
          AND "questionId" = NEW."questionId";
      IF restored_number IS NULL OR restored_number >= NEW."versionNumber" THEN
        RAISE EXCEPTION 'Restoration source must be an earlier version of the same Question';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "question_version_completion_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v "QuestionVersion"%ROWTYPE;
  content_row "QuestionVersionContent"%ROWTYPE;
  answer_row "QuestionVersionAnswerKey"%ROWTYPE;
  content_count BIGINT;
  answer_count BIGINT;
  option_count BIGINT;
  left_count BIGINT;
  right_count BIGINT;
  ordering_count BIGINT;
  blank_count BIGINT;
  count_value BIGINT;
BEGIN
  SELECT * INTO v FROM "QuestionVersion" WHERE "id" = NEW."id";
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v."completedAt" IS NULL THEN
    RAISE EXCEPTION 'QuestionVersion must be completed before its transaction can commit';
  END IF;

  SELECT COUNT(*) INTO content_count
    FROM "QuestionVersionContent" WHERE "questionVersionId" = v."id";
  SELECT COUNT(*) INTO answer_count
    FROM "QuestionVersionAnswerKey" WHERE "questionVersionId" = v."id";
  IF content_count <> 1 OR answer_count <> 1 THEN
    RAISE EXCEPTION 'Completed QuestionVersion requires exactly one content record and one answer key';
  END IF;

  SELECT * INTO STRICT content_row
    FROM "QuestionVersionContent" WHERE "questionVersionId" = v."id";
  SELECT * INTO STRICT answer_row
    FROM "QuestionVersionAnswerKey" WHERE "questionVersionId" = v."id";

  IF content_row."questionType" <> v."questionType"
     OR answer_row."questionType" <> v."questionType" THEN
    RAISE EXCEPTION 'QuestionVersion, content, and answer key discriminators must agree';
  END IF;

  IF v."questionType" = 'MATCHING' THEN
    IF content_row."matchingMode" IS NULL THEN
      RAISE EXCEPTION 'MATCHING content requires matchingMode';
    END IF;
  ELSIF content_row."matchingMode" IS NOT NULL THEN
    RAISE EXCEPTION 'matchingMode is only valid for MATCHING questions';
  END IF;

  IF v."questionType" = 'FILL_IN_THE_BLANK' THEN
    IF content_row."promptText" IS NOT NULL OR content_row."numericUnit" IS NOT NULL THEN
      RAISE EXCEPTION 'Fill-in-the-blank content must be represented by ordered segments';
    END IF;
  ELSE
    IF content_row."promptText" IS NULL THEN
      RAISE EXCEPTION 'Question content requires promptText';
    END IF;
    IF v."questionType" <> 'NUMERIC' AND content_row."numericUnit" IS NOT NULL THEN
      RAISE EXCEPTION 'numericUnit is only valid for NUMERIC questions';
    END IF;
  END IF;

  -- Count every typed content collection.
  SELECT COUNT(*) INTO option_count FROM "QuestionVersionOption" WHERE "questionVersionId" = v."id";
  SELECT COUNT(*) INTO left_count FROM "QuestionVersionMatchingLeftItem" WHERE "questionVersionId" = v."id";
  SELECT COUNT(*) INTO right_count FROM "QuestionVersionMatchingRightItem" WHERE "questionVersionId" = v."id";
  SELECT COUNT(*) INTO ordering_count FROM "QuestionVersionOrderingItem" WHERE "questionVersionId" = v."id";
  SELECT COUNT(*) INTO blank_count
    FROM "QuestionVersionFillBlankSegment"
    WHERE "questionVersionId" = v."id" AND "kind" = 'BLANK';

  -- Reject content structures that do not belong to the selected question type.
  IF v."questionType" NOT IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE') AND option_count <> 0 THEN
    RAISE EXCEPTION 'Options are only valid for choice questions';
  END IF;
  IF v."questionType" <> 'MATCHING' AND (left_count <> 0 OR right_count <> 0) THEN
    RAISE EXCEPTION 'Matching items are only valid for MATCHING questions';
  END IF;
  IF v."questionType" <> 'ORDERING' AND ordering_count <> 0 THEN
    RAISE EXCEPTION 'Ordering items are only valid for ORDERING questions';
  END IF;
  IF v."questionType" <> 'FILL_IN_THE_BLANK' AND EXISTS (
    SELECT 1 FROM "QuestionVersionFillBlankSegment" WHERE "questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Fill-in-the-blank segments are only valid for FILL_IN_THE_BLANK questions';
  END IF;

  -- Reject scalar answer-key fields that do not belong to the selected type.
  IF v."questionType" <> 'TRUE_FALSE' AND answer_row."correctBoolean" IS NOT NULL THEN
    RAISE EXCEPTION 'correctBoolean is only valid for TRUE_FALSE questions';
  END IF;
  IF v."questionType" <> 'NUMERIC' AND answer_row."expectedNumericValue" IS NOT NULL THEN
    RAISE EXCEPTION 'expectedNumericValue is only valid for NUMERIC questions';
  END IF;
  IF v."questionType" <> 'LONG_ANSWER' AND answer_row."referenceAnswer" IS NOT NULL THEN
    RAISE EXCEPTION 'referenceAnswer is only valid for LONG_ANSWER questions';
  END IF;

  -- Reject answer child structures that do not belong to the selected type.
  IF v."questionType" NOT IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE') AND EXISTS (
    SELECT 1 FROM "QuestionVersionOptionAnswer" oa
    WHERE oa."questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Option answers are only valid for choice questions';
  END IF;
  IF v."questionType" <> 'SHORT_ANSWER' AND EXISTS (
    SELECT 1 FROM "QuestionVersionAcceptedAnswer" aa
    WHERE aa."questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Accepted text answers are only valid for SHORT_ANSWER questions';
  END IF;
  IF v."questionType" <> 'MATCHING' AND EXISTS (
    SELECT 1 FROM "QuestionVersionMatchingPair" mp
    WHERE mp."questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Matching pairs are only valid for MATCHING questions';
  END IF;
  IF v."questionType" <> 'ORDERING' AND EXISTS (
    SELECT 1 FROM "QuestionVersionOrderingAnswer" oa
    WHERE oa."questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Ordering answers are only valid for ORDERING questions';
  END IF;
  IF v."questionType" <> 'FILL_IN_THE_BLANK' AND EXISTS (
    SELECT 1 FROM "QuestionVersionBlankAnswer" ba
    WHERE ba."questionVersionId" = v."id"
  ) THEN
    RAISE EXCEPTION 'Blank answers are only valid for FILL_IN_THE_BLANK questions';
  END IF;

  -- Type-specific answer-key invariants.
  IF v."questionType" = 'SINGLE_CHOICE' THEN
    SELECT COUNT(*) INTO count_value
      FROM "QuestionVersionOptionAnswer" WHERE "questionVersionId" = v."id";
    IF count_value <> 1 THEN
      RAISE EXCEPTION 'SINGLE_CHOICE requires exactly one correct option';
    END IF;
  ELSIF v."questionType" = 'TRUE_FALSE' THEN
    IF answer_row."correctBoolean" IS NULL THEN
      RAISE EXCEPTION 'TRUE_FALSE requires correctBoolean';
    END IF;
  ELSIF v."questionType" = 'NUMERIC' THEN
    IF answer_row."expectedNumericValue" IS NULL THEN
      RAISE EXCEPTION 'NUMERIC requires expectedNumericValue';
    END IF;
  ELSIF v."questionType" = 'LONG_ANSWER' THEN
    IF answer_row."referenceAnswer" IS NULL THEN
      RAISE EXCEPTION 'LONG_ANSWER requires referenceAnswer';
    END IF;
  ELSIF v."questionType" = 'MATCHING' THEN
    -- The matching-pair primary key permits at most one mapping per left item.
    -- Equal cardinality plus same-version foreign keys therefore requires one
    -- mapping for every left item, with no omissions or duplicates.
    SELECT COUNT(*) INTO count_value
      FROM "QuestionVersionMatchingPair" WHERE "questionVersionId" = v."id";
    IF count_value <> left_count THEN
      RAISE EXCEPTION 'MATCHING requires exactly one correct right-item mapping for every left item';
    END IF;
    IF content_row."matchingMode" = 'ONE_TO_ONE' AND EXISTS (
      SELECT 1 FROM "QuestionVersionMatchingPair"
      WHERE "questionVersionId" = v."id"
      GROUP BY "rightItemId" HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'ONE_TO_ONE matching cannot reuse a right item';
    END IF;
  ELSIF v."questionType" = 'ORDERING' THEN
    SELECT COUNT(*) INTO count_value
      FROM "QuestionVersionOrderingAnswer" WHERE "questionVersionId" = v."id";
    IF count_value <> ordering_count THEN
      RAISE EXCEPTION 'ORDERING answer must contain every ordering item exactly once';
    END IF;
  ELSIF v."questionType" = 'FILL_IN_THE_BLANK' THEN
    SELECT COUNT(*) INTO count_value
      FROM "QuestionVersionBlankAnswer" WHERE "questionVersionId" = v."id";
    IF count_value <> blank_count THEN
      RAISE EXCEPTION 'FILL_IN_THE_BLANK requires exactly one answer group for every blank segment';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "QuestionVersionBlankAnswer" ba
      JOIN "QuestionVersionFillBlankSegment" fs
        ON fs."questionVersionId" = ba."questionVersionId"
       AND fs."id" = ba."blankSegmentId"
      WHERE ba."questionVersionId" = v."id"
        AND fs."kind" <> 'BLANK'
    ) THEN
      RAISE EXCEPTION 'Blank answer groups must reference BLANK segments';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
