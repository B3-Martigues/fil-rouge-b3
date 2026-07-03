BEGIN;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS external_image_url TEXT,
    ADD COLUMN IF NOT EXISTS image_optimized_url TEXT,
    ADD COLUMN IF NOT EXISTS image_thumbnail_url TEXT;

UPDATE events
SET external_image_url = image
WHERE external_image_url IS NULL
  AND image IS NOT NULL
  AND (image LIKE 'http://%' OR image LIKE 'https://%');

CREATE INDEX IF NOT EXISTS idx_events_external_image_url
ON events(external_image_url)
WHERE external_image_url IS NOT NULL;

COMMIT;
