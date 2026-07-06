BEGIN;

ALTER TABLE moderation_decisions
    ADD COLUMN IF NOT EXISTS report_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_moderation_decisions_report'
    ) THEN
        ALTER TABLE moderation_decisions
            ADD CONSTRAINT fk_moderation_decisions_report
            FOREIGN KEY (report_id)
            REFERENCES moderation_reports(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_report
ON moderation_decisions(report_id);

COMMIT;
