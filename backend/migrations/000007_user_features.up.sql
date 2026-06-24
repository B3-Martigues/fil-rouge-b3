BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash  VARCHAR(64) PRIMARY KEY,
    account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_account
ON password_reset_tokens(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_event_preferences (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_category_id  INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_preferences_user
ON user_event_preferences(user_id);

COMMIT;
