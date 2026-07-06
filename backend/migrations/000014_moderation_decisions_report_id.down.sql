BEGIN;

DROP INDEX IF EXISTS idx_moderation_decisions_report;

ALTER TABLE moderation_decisions
    DROP CONSTRAINT IF EXISTS fk_moderation_decisions_report,
    DROP COLUMN IF EXISTS report_id;

COMMIT;
