BEGIN;

CREATE TABLE IF NOT EXISTS media (
    id               BIGSERIAL PRIMARY KEY,
    owner_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    entity_type      VARCHAR(30) NOT NULL,
    entity_id        BIGINT,
    file_name        VARCHAR(255) NOT NULL,
    file_path        VARCHAR(255) NOT NULL,
    public_url       VARCHAR(255) NOT NULL,
    mime_type        VARCHAR(100) NOT NULL,
    size_bytes       BIGINT NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMP,

    CONSTRAINT chk_media_entity_type CHECK (entity_type IN ('organization', 'event')),
    CONSTRAINT chk_media_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_media_owner_active
ON media(owner_account_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_media_entity_active
ON media(entity_type, entity_id, deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_public_url
ON media(public_url);

COMMIT;
