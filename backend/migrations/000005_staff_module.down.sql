BEGIN;

DROP TABLE IF EXISTS moderation_decisions;
DROP TABLE IF EXISTS moderation_reports;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS notification_types;

ALTER TABLE events
    DROP COLUMN IF EXISTS suspension_reason,
    DROP COLUMN IF EXISTS suspended_until;

COMMIT;
