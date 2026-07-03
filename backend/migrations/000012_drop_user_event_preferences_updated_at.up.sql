BEGIN;

ALTER TABLE user_event_preferences
    DROP COLUMN IF EXISTS updated_at;

COMMIT;
