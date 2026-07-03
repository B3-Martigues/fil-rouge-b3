BEGIN;

DROP INDEX IF EXISTS idx_events_external_image_url;

ALTER TABLE events
    DROP COLUMN IF EXISTS image_thumbnail_url,
    DROP COLUMN IF EXISTS image_optimized_url,
    DROP COLUMN IF EXISTS external_image_url;

COMMIT;
