BEGIN;

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    role            VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_role
        CHECK (role IN ('user', 'admin', 'moderator', 'organization'))
);

CREATE TABLE auth_refresh_tokens (
    subject     VARCHAR(255) PRIMARY KEY,
    jti         VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_refresh_tokens_expires_at
ON auth_refresh_tokens(expires_at);

CREATE TABLE http_rate_limits (
    bucket_key          TEXT PRIMARY KEY,
    request_count       INTEGER NOT NULL,
    window_started_at   TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_http_rate_limits_request_count
        CHECK (request_count > 0)
);

CREATE INDEX idx_http_rate_limits_updated_at
ON http_rate_limits(updated_at);

COMMIT;
