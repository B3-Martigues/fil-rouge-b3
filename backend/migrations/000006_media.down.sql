BEGIN;

DROP INDEX IF EXISTS idx_media_public_url;
DROP INDEX IF EXISTS idx_media_entity_active;
DROP INDEX IF EXISTS idx_media_owner_active;
DROP TABLE IF EXISTS media;

COMMIT;
