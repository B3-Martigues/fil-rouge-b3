BEGIN;

DROP INDEX IF EXISTS idx_events_source_url_unique;

ALTER TABLE events
    DROP COLUMN IF EXISTS source_url;

ALTER TABLE events
    DROP COLUMN IF EXISTS time_start,
    DROP COLUMN IF EXISTS time_end;

UPDATE events
SET price = 0
WHERE price IS NULL;

UPDATE events
SET ticketing_link = ''
WHERE ticketing_link IS NULL;

DELETE FROM events
WHERE organization_id IS NULL;

ALTER TABLE events
    ALTER COLUMN price SET NOT NULL,
    ALTER COLUMN ticketing_link SET NOT NULL;

ALTER TABLE events
    ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
