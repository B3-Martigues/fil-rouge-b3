BEGIN;

ALTER TABLE user_event_preferences
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

COMMIT;
