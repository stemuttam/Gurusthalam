-- Phase 5.14-E-C: normalized Question Bank persistence.
-- PostgreSQL migration for Prisma 7.9.1.
-- No JSON/JSONB payload columns are used.
--
-- Snapshot write protocol:
--   1. Insert QuestionVersion with completedAt = NULL.
--   2. Insert exactly one QuestionVersionContent and AnswerKey plus typed children.
--   3. Set completedAt in the SAME transaction.
--   4. The deferred constraint trigger validates the complete snapshot at commit.
-- Completed versions and all their descendants are immutable.

CREATE TYPE "QuestionBankType" AS ENUM (
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'NUMERIC',
  'MATCHING',
  'ORDERING',
  'FILL_IN_THE_BLANK'
);

CREATE TYPE "QuestionBankAnswerFormat" AS ENUM (
  'SELECTED_OPTION',
  'SELECTED_OPTIONS',
  'BOOLEAN',
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'MATCHING_PAIRS',
  'ORDERED_ITEMS',
  'BLANK_RESPONSES'
);

CREATE TYPE "QuestionBankFillBlankSegmentKind" AS ENUM ('TEXT', 'BLANK');

CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

CREATE TABLE "QuestionVersion" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "questionType" "QuestionBankType" NOT NULL,
  "answerFormat" "QuestionBankAnswerFormat" NOT NULL,
  "previousVersionId" TEXT,
  "restoredFromVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersion_positive_version" CHECK ("versionNumber" >= 1),
  CONSTRAINT "QuestionVersion_type_format_check" CHECK (
    ("questionType" = 'SINGLE_CHOICE' AND "answerFormat" = 'SELECTED_OPTION') OR
    ("questionType" = 'MULTIPLE_CHOICE' AND "answerFormat" = 'SELECTED_OPTIONS') OR
    ("questionType" = 'TRUE_FALSE' AND "answerFormat" = 'BOOLEAN') OR
    ("questionType" = 'SHORT_ANSWER' AND "answerFormat" = 'SHORT_TEXT') OR
    ("questionType" = 'LONG_ANSWER' AND "answerFormat" = 'LONG_TEXT') OR
    ("questionType" = 'NUMERIC' AND "answerFormat" = 'NUMBER') OR
    ("questionType" = 'MATCHING' AND "answerFormat" = 'MATCHING_PAIRS') OR
    ("questionType" = 'ORDERING' AND "answerFormat" = 'ORDERED_ITEMS') OR
    ("questionType" = 'FILL_IN_THE_BLANK' AND "answerFormat" = 'BLANK_RESPONSES')
  ),
  CONSTRAINT "QuestionVersion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersion_id_questionId_key" UNIQUE ("id", "questionId"),
  CONSTRAINT "QuestionVersion_questionId_versionNumber_key" UNIQUE ("questionId", "versionNumber"),
  CONSTRAINT "QuestionVersion_previous_same_question_fkey"
    FOREIGN KEY ("previousVersionId", "questionId")
    REFERENCES "QuestionVersion"("id", "questionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersion_restored_same_question_fkey"
    FOREIGN KEY ("restoredFromVersionId", "questionId")
    REFERENCES "QuestionVersion"("id", "questionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersion_not_self_previous"
    CHECK ("previousVersionId" IS NULL OR "previousVersionId" <> "id"),
  CONSTRAINT "QuestionVersion_not_self_restored"
    CHECK ("restoredFromVersionId" IS NULL OR "restoredFromVersionId" <> "id")
);

CREATE INDEX "QuestionVersion_questionId_createdAt_idx"
  ON "QuestionVersion"("questionId", "createdAt");
CREATE INDEX "QuestionVersion_previousVersionId_idx"
  ON "QuestionVersion"("previousVersionId");
CREATE INDEX "QuestionVersion_restoredFromVersionId_idx"
  ON "QuestionVersion"("restoredFromVersionId");

CREATE TABLE "QuestionVersionContent" (
  "id" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "questionType" "QuestionBankType" NOT NULL,
  "promptText" TEXT,
  "numericUnit" TEXT,
  CONSTRAINT "QuestionVersionContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersionContent_questionVersionId_key" UNIQUE ("questionVersionId"),
  CONSTRAINT "QuestionVersionContent_id_questionVersionId_key" UNIQUE ("id", "questionVersionId"),
  CONSTRAINT "QuestionVersionContent_version_fkey"
    FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionOption" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionOption_pkey" PRIMARY KEY ("questionVersionId", "id"),
  CONSTRAINT "QuestionVersionOption_content_position_key" UNIQUE ("contentId", "position"),
  CONSTRAINT "QuestionVersionOption_content_version_fkey"
    FOREIGN KEY ("contentId", "questionVersionId")
    REFERENCES "QuestionVersionContent"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "QuestionVersionOption_contentId_idx"
  ON "QuestionVersionOption"("contentId");

CREATE TABLE "QuestionVersionMatchingLeftItem" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionMatchingLeftItem_pkey" PRIMARY KEY ("questionVersionId", "id"),
  CONSTRAINT "QuestionVersionMatchingLeftItem_content_position_key" UNIQUE ("contentId", "position"),
  CONSTRAINT "QuestionVersionMatchingLeftItem_content_version_fkey"
    FOREIGN KEY ("contentId", "questionVersionId")
    REFERENCES "QuestionVersionContent"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionMatchingRightItem" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionMatchingRightItem_pkey" PRIMARY KEY ("questionVersionId", "id"),
  CONSTRAINT "QuestionVersionMatchingRightItem_content_position_key" UNIQUE ("contentId", "position"),
  CONSTRAINT "QuestionVersionMatchingRightItem_content_version_fkey"
    FOREIGN KEY ("contentId", "questionVersionId")
    REFERENCES "QuestionVersionContent"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionOrderingItem" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionOrderingItem_pkey" PRIMARY KEY ("questionVersionId", "id"),
  CONSTRAINT "QuestionVersionOrderingItem_content_position_key" UNIQUE ("contentId", "position"),
  CONSTRAINT "QuestionVersionOrderingItem_content_version_fkey"
    FOREIGN KEY ("contentId", "questionVersionId")
    REFERENCES "QuestionVersionContent"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionFillBlankSegment" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "kind" "QuestionBankFillBlankSegmentKind" NOT NULL,
  "text" TEXT,
  "blankId" TEXT,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionFillBlankSegment_pkey" PRIMARY KEY ("questionVersionId", "id"),
  CONSTRAINT "QuestionVersionFillBlankSegment_content_position_key" UNIQUE ("contentId", "position"),
  CONSTRAINT "QuestionVersionFillBlankSegment_questionVersionId_blankId_key"
    UNIQUE ("questionVersionId", "blankId"),
  CONSTRAINT "QuestionVersionFillBlankSegment_shape_check" CHECK (
    ("kind" = 'TEXT' AND "text" IS NOT NULL AND "blankId" IS NULL) OR
    ("kind" = 'BLANK' AND "text" IS NULL AND "blankId" IS NOT NULL)
  ),
  CONSTRAINT "QuestionVersionFillBlankSegment_content_version_fkey"
    FOREIGN KEY ("contentId", "questionVersionId")
    REFERENCES "QuestionVersionContent"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionAnswerKey" (
  "id" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "questionType" "QuestionBankType" NOT NULL,
  "correctBoolean" BOOLEAN,
  "expectedNumericValue" DOUBLE PRECISION,
  "referenceAnswer" TEXT,
  CONSTRAINT "QuestionVersionAnswerKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersionAnswerKey_questionVersionId_key" UNIQUE ("questionVersionId"),
  CONSTRAINT "QuestionVersionAnswerKey_id_questionVersionId_key" UNIQUE ("id", "questionVersionId"),
  CONSTRAINT "QuestionVersionAnswerKey_version_fkey"
    FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionAnswerKey_numeric_finite_check" CHECK (
    "expectedNumericValue" IS NULL OR
    "expectedNumericValue" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
  )
);

CREATE TABLE "QuestionVersionOptionAnswer" (
  "answerKeyId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionOptionAnswer_pkey" PRIMARY KEY ("answerKeyId", "optionId"),
  CONSTRAINT "QuestionVersionOptionAnswer_position_key" UNIQUE ("answerKeyId", "position"),
  CONSTRAINT "QuestionVersionOptionAnswer_key_fkey"
    FOREIGN KEY ("answerKeyId", "questionVersionId")
    REFERENCES "QuestionVersionAnswerKey"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionOptionAnswer_option_fkey"
    FOREIGN KEY ("questionVersionId", "optionId")
    REFERENCES "QuestionVersionOption"("questionVersionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionAcceptedAnswer" (
  "id" TEXT NOT NULL,
  "answerKeyId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionAcceptedAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersionAcceptedAnswer_position_key" UNIQUE ("answerKeyId", "position"),
  CONSTRAINT "QuestionVersionAcceptedAnswer_key_fkey"
    FOREIGN KEY ("answerKeyId", "questionVersionId")
    REFERENCES "QuestionVersionAnswerKey"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "QuestionVersionAcceptedAnswer_answerKeyId_idx"
  ON "QuestionVersionAcceptedAnswer"("answerKeyId");

CREATE TABLE "QuestionVersionMatchingPair" (
  "answerKeyId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "leftItemId" TEXT NOT NULL,
  "rightItemId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  -- One correct right-item mapping per left item.
  -- Multiple left items may reference the same right item.
  CONSTRAINT "QuestionVersionMatchingPair_pkey" PRIMARY KEY ("answerKeyId", "leftItemId"),
  CONSTRAINT "QuestionVersionMatchingPair_position_key" UNIQUE ("answerKeyId", "position"),
  CONSTRAINT "QuestionVersionMatchingPair_key_fkey"
    FOREIGN KEY ("answerKeyId", "questionVersionId")
    REFERENCES "QuestionVersionAnswerKey"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionMatchingPair_left_fkey"
    FOREIGN KEY ("questionVersionId", "leftItemId")
    REFERENCES "QuestionVersionMatchingLeftItem"("questionVersionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionMatchingPair_right_fkey"
    FOREIGN KEY ("questionVersionId", "rightItemId")
    REFERENCES "QuestionVersionMatchingRightItem"("questionVersionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionOrderingAnswer" (
  "answerKeyId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionOrderingAnswer_pkey" PRIMARY KEY ("answerKeyId", "itemId"),
  CONSTRAINT "QuestionVersionOrderingAnswer_position_key" UNIQUE ("answerKeyId", "position"),
  CONSTRAINT "QuestionVersionOrderingAnswer_key_fkey"
    FOREIGN KEY ("answerKeyId", "questionVersionId")
    REFERENCES "QuestionVersionAnswerKey"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionOrderingAnswer_item_fkey"
    FOREIGN KEY ("questionVersionId", "itemId")
    REFERENCES "QuestionVersionOrderingItem"("questionVersionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionBlankAnswer" (
  "answerKeyId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "blankSegmentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionBlankAnswer_pkey" PRIMARY KEY ("answerKeyId", "blankSegmentId"),
  CONSTRAINT "QuestionVersionBlankAnswer_answerKeyId_position_key"
    UNIQUE ("answerKeyId", "position"),
  CONSTRAINT "QuestionVersionBlankAnswer_questionVersionId_blankSegmentId_key"
    UNIQUE ("questionVersionId", "blankSegmentId"),
  CONSTRAINT "QuestionVersionBlankAnswer_answerKey_fkey"
    FOREIGN KEY ("answerKeyId", "questionVersionId")
    REFERENCES "QuestionVersionAnswerKey"("id", "questionVersionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "QuestionVersionBlankAnswer_blank_fkey"
    FOREIGN KEY ("questionVersionId", "blankSegmentId")
    REFERENCES "QuestionVersionFillBlankSegment"("questionVersionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "QuestionVersionBlankAcceptedAnswer" (
  "id" TEXT NOT NULL,
  "answerKeyId" TEXT NOT NULL,
  "blankSegmentId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuestionVersionBlankAcceptedAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersionBlankAcceptedAnswer_position_key"
    UNIQUE ("answerKeyId", "blankSegmentId", "position"),
  CONSTRAINT "QuestionVersionBlankAcceptedAnswer_blank_fkey"
    FOREIGN KEY ("answerKeyId", "blankSegmentId")
    REFERENCES "QuestionVersionBlankAnswer"("answerKeyId", "blankSegmentId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Align Prisma-managed constraint/index names with the generated
-- Prisma 7.9.1 schema diff. Preserve the additional custom CHECK
-- constraints and trigger functions defined in this migration.

ALTER TABLE "QuestionVersion"
  RENAME CONSTRAINT "QuestionVersion_previous_same_question_fkey"
  TO "QuestionVersion_previousVersionId_questionId_fkey";

ALTER TABLE "QuestionVersion"
  RENAME CONSTRAINT "QuestionVersion_restored_same_question_fkey"
  TO "QuestionVersion_restoredFromVersionId_questionId_fkey";

ALTER TABLE "QuestionVersionContent"
  RENAME CONSTRAINT "QuestionVersionContent_version_fkey"
  TO "QuestionVersionContent_questionVersionId_fkey";

ALTER TABLE "QuestionVersionOption"
  RENAME CONSTRAINT "QuestionVersionOption_content_position_key"
  TO "QuestionVersionOption_contentId_position_key";

ALTER TABLE "QuestionVersionMatchingLeftItem"
  RENAME CONSTRAINT "QuestionVersionMatchingLeftItem_content_position_key"
  TO "QuestionVersionMatchingLeftItem_contentId_position_key";

ALTER TABLE "QuestionVersionMatchingRightItem"
  RENAME CONSTRAINT "QuestionVersionMatchingRightItem_content_position_key"
  TO "QuestionVersionMatchingRightItem_contentId_position_key";

ALTER TABLE "QuestionVersionOrderingItem"
  RENAME CONSTRAINT "QuestionVersionOrderingItem_content_position_key"
  TO "QuestionVersionOrderingItem_contentId_position_key";

ALTER TABLE "QuestionVersionFillBlankSegment"
  RENAME CONSTRAINT "QuestionVersionFillBlankSegment_content_position_key"
  TO "QuestionVersionFillBlankSegment_contentId_position_key";

ALTER TABLE "QuestionVersionAnswerKey"
  RENAME CONSTRAINT "QuestionVersionAnswerKey_version_fkey"
  TO "QuestionVersionAnswerKey_questionVersionId_fkey";

ALTER TABLE "QuestionVersionOptionAnswer"
  RENAME CONSTRAINT "QuestionVersionOptionAnswer_position_key"
  TO "QuestionVersionOptionAnswer_answerKeyId_position_key";

ALTER TABLE "QuestionVersionOptionAnswer"
  RENAME CONSTRAINT "QuestionVersionOptionAnswer_key_fkey"
  TO "QuestionVersionOptionAnswer_answerKeyId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionOptionAnswer"
  RENAME CONSTRAINT "QuestionVersionOptionAnswer_option_fkey"
  TO "QuestionVersionOptionAnswer_questionVersionId_optionId_fkey";

ALTER TABLE "QuestionVersionAcceptedAnswer"
  RENAME CONSTRAINT "QuestionVersionAcceptedAnswer_position_key"
  TO "QuestionVersionAcceptedAnswer_answerKeyId_position_key";

ALTER TABLE "QuestionVersionAcceptedAnswer"
  RENAME CONSTRAINT "QuestionVersionAcceptedAnswer_key_fkey"
  TO "QuestionVersionAcceptedAnswer_answerKeyId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionMatchingPair"
  RENAME CONSTRAINT "QuestionVersionMatchingPair_position_key"
  TO "QuestionVersionMatchingPair_answerKeyId_position_key";

ALTER TABLE "QuestionVersionMatchingPair"
  RENAME CONSTRAINT "QuestionVersionMatchingPair_key_fkey"
  TO "QuestionVersionMatchingPair_answerKeyId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionMatchingPair"
  RENAME CONSTRAINT "QuestionVersionMatchingPair_left_fkey"
  TO "QuestionVersionMatchingPair_questionVersionId_leftItemId_fkey";

ALTER TABLE "QuestionVersionMatchingPair"
  RENAME CONSTRAINT "QuestionVersionMatchingPair_right_fkey"
  TO "QuestionVersionMatchingPair_questionVersionId_rightItemId_fkey";

ALTER TABLE "QuestionVersionOrderingAnswer"
  RENAME CONSTRAINT "QuestionVersionOrderingAnswer_position_key"
  TO "QuestionVersionOrderingAnswer_answerKeyId_position_key";

ALTER TABLE "QuestionVersionOrderingAnswer"
  RENAME CONSTRAINT "QuestionVersionOrderingAnswer_key_fkey"
  TO "QuestionVersionOrderingAnswer_answerKeyId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionOrderingAnswer"
  RENAME CONSTRAINT "QuestionVersionOrderingAnswer_item_fkey"
  TO "QuestionVersionOrderingAnswer_questionVersionId_itemId_fkey";

ALTER TABLE "QuestionVersionBlankAnswer"
  RENAME CONSTRAINT "QuestionVersionBlankAnswer_answerKey_fkey"
  TO "QuestionVersionBlankAnswer_answerKeyId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionBlankAnswer"
  RENAME CONSTRAINT "QuestionVersionBlankAnswer_blank_fkey"
  TO "QuestionVersionBlankAnswer_questionVersionId_blankSegmentId_fkey";

ALTER TABLE "QuestionVersionBlankAcceptedAnswer"
  RENAME CONSTRAINT "QuestionVersionBlankAcceptedAnswer_position_key"
  TO "QuestionVersionBlankAcceptedAnswer_answerKeyId_blankSegment_key";

ALTER TABLE "QuestionVersionBlankAcceptedAnswer"
  RENAME CONSTRAINT "QuestionVersionBlankAcceptedAnswer_blank_fkey"
  TO "QuestionVersionBlankAcceptedAnswer_answerKeyId_blankSegmentId_fkey";

-- Align the remaining typed-content foreign-key names with
-- the Prisma 7.9.1 generated schema DDL.

ALTER TABLE "QuestionVersionOption"
  RENAME CONSTRAINT "QuestionVersionOption_content_version_fkey"
  TO "QuestionVersionOption_contentId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionMatchingLeftItem"
  RENAME CONSTRAINT "QuestionVersionMatchingLeftItem_content_version_fkey"
  TO "QuestionVersionMatchingLeftItem_contentId_questionVersionI_fkey";

ALTER TABLE "QuestionVersionMatchingRightItem"
  RENAME CONSTRAINT "QuestionVersionMatchingRightItem_content_version_fkey"
  TO "QuestionVersionMatchingRightItem_contentId_questionVersion_fkey";

ALTER TABLE "QuestionVersionOrderingItem"
  RENAME CONSTRAINT "QuestionVersionOrderingItem_content_version_fkey"
  TO "QuestionVersionOrderingItem_contentId_questionVersionId_fkey";

ALTER TABLE "QuestionVersionFillBlankSegment"
  RENAME CONSTRAINT "QuestionVersionFillBlankSegment_content_version_fkey"
  TO "QuestionVersionFillBlankSegment_contentId_questionVersionI_fkey";

-- Serialize version creation for each Question and enforce sequential numbering,
-- immediate predecessor identity, and earlier same-question restoration sources.
CREATE FUNCTION "question_version_lineage_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  latest_number INTEGER;
  previous_number INTEGER;
  restored_number INTEGER;
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

CREATE TRIGGER "QuestionVersion_lineage_guard"
BEFORE INSERT ON "QuestionVersion"
FOR EACH ROW EXECUTE FUNCTION "question_version_lineage_guard"();

-- A completed snapshot must have one content record and one answer key, matching
-- discriminators, and only the typed structures permitted for its question type.
-- Empty arrays remain valid where the domain contract permits them.
CREATE FUNCTION "question_version_completion_guard"() RETURNS trigger
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

CREATE CONSTRAINT TRIGGER "QuestionVersion_complete_snapshot_check"
AFTER INSERT OR UPDATE ON "QuestionVersion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "question_version_completion_guard"();

-- Version metadata is immutable after insertion except for the one-way completion
-- transition from NULL to a timestamp. A completed version cannot be updated/deleted.
CREATE FUNCTION "question_version_row_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."completedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Completed QuestionVersion snapshots cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."completedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Completed QuestionVersion snapshots are immutable';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."questionId" IS DISTINCT FROM OLD."questionId"
     OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
     OR NEW."questionType" IS DISTINCT FROM OLD."questionType"
     OR NEW."answerFormat" IS DISTINCT FROM OLD."answerFormat"
     OR NEW."previousVersionId" IS DISTINCT FROM OLD."previousVersionId"
     OR NEW."restoredFromVersionId" IS DISTINCT FROM OLD."restoredFromVersionId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."completedAt" IS NULL THEN
    RAISE EXCEPTION 'QuestionVersion metadata is immutable; only completion may transition from NULL to a timestamp';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "QuestionVersion_row_guard"
BEFORE UPDATE OR DELETE ON "QuestionVersion"
FOR EACH ROW EXECUTE FUNCTION "question_version_row_guard"();

-- Resolve the owning version for every child table, including the blank accepted
-- answer table whose Prisma model intentionally has no questionVersionId column.
CREATE FUNCTION "question_version_child_mutation_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_version_id TEXT;
  new_version_id TEXT;
  completed_at TIMESTAMP(3);
BEGIN
  IF TG_TABLE_NAME = 'QuestionVersionBlankAcceptedAnswer' THEN
    IF TG_OP <> 'INSERT' THEN
      SELECT "questionVersionId" INTO old_version_id
      FROM "QuestionVersionBlankAnswer"
      WHERE "answerKeyId" = OLD."answerKeyId"
        AND "blankSegmentId" = OLD."blankSegmentId";
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT "questionVersionId" INTO new_version_id
      FROM "QuestionVersionBlankAnswer"
      WHERE "answerKeyId" = NEW."answerKeyId"
        AND "blankSegmentId" = NEW."blankSegmentId";
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      old_version_id := OLD."questionVersionId";
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_version_id := NEW."questionVersionId";
    END IF;
  END IF;

  -- Serialize child mutations with completion. Lock affected parent versions
  -- in deterministic ID order so a concurrent completion cannot race this guard.
  PERFORM 1
  FROM "QuestionVersion"
  WHERE "id" IN (old_version_id, new_version_id)
  ORDER BY "id"
  FOR UPDATE;

  IF old_version_id IS NOT NULL THEN
    SELECT "completedAt" INTO completed_at
    FROM "QuestionVersion" WHERE "id" = old_version_id;
    IF completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Completed QuestionVersion snapshots are immutable';
    END IF;
  END IF;

  IF new_version_id IS NOT NULL THEN
    SELECT "completedAt" INTO completed_at
    FROM "QuestionVersion" WHERE "id" = new_version_id;
    IF completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot add or move records into a completed QuestionVersion';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply the same guard to INSERT, UPDATE, and DELETE on every snapshot descendant.
CREATE TRIGGER "QuestionVersionContent_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionContent"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionOption_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionOption"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionMatchingLeftItem_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionMatchingLeftItem"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionMatchingRightItem_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionMatchingRightItem"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionOrderingItem_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionOrderingItem"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionFillBlankSegment_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionFillBlankSegment"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionAnswerKey_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionAnswerKey"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionOptionAnswer_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionOptionAnswer"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionAcceptedAnswer_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionAcceptedAnswer"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionMatchingPair_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionMatchingPair"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionOrderingAnswer_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionOrderingAnswer"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionBlankAnswer_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionBlankAnswer"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();
CREATE TRIGGER "QuestionVersionBlankAcceptedAnswer_mutation_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "QuestionVersionBlankAcceptedAnswer"
FOR EACH ROW EXECUTE FUNCTION "question_version_child_mutation_guard"();

-- Align Question Bank foreign-key constraint names with Prisma schema.

ALTER TABLE "QuestionVersionAcceptedAnswer"
RENAME CONSTRAINT "QuestionVersionAcceptedAnswer_answerKeyId_questionVersionId_fke"
TO "QuestionVersionAcceptedAnswer_answerKeyId_questionVersionI_fkey";

ALTER TABLE "QuestionVersionBlankAcceptedAnswer"
RENAME CONSTRAINT "QuestionVersionBlankAcceptedAnswer_answerKeyId_blankSegmentId_f"
TO "QuestionVersionBlankAcceptedAnswer_answerKeyId_blankSegmen_fkey";

ALTER TABLE "QuestionVersionBlankAnswer"
RENAME CONSTRAINT "QuestionVersionBlankAnswer_questionVersionId_blankSegmentId_fke"
TO "QuestionVersionBlankAnswer_questionVersionId_blankSegmentI_fkey";

ALTER TABLE "QuestionVersionOrderingAnswer"
RENAME CONSTRAINT "QuestionVersionOrderingAnswer_answerKeyId_questionVersionId_fke"
TO "QuestionVersionOrderingAnswer_answerKeyId_questionVersionI_fkey";