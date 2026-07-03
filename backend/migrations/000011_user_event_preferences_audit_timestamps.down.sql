BEGIN;

ALTER TABLE user_event_preferences
    ALTER COLUMN created_at SET DEFAULT NOW();

COMMIT;
