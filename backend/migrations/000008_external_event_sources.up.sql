BEGIN;

ALTER TABLE events
    ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS time_start TIME,
    ADD COLUMN IF NOT EXISTS time_end TIME;

ALTER TABLE events
    ALTER COLUMN price DROP NOT NULL,
    ALTER COLUMN ticketing_link DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_url_unique
ON events(source_url)
WHERE source_url IS NOT NULL;

COMMIT;
