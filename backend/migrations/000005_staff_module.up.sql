BEGIN;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE TABLE IF NOT EXISTS notification_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    slug        VARCHAR(80) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO notification_types (id, name, slug) VALUES
    (1, 'Evenement favori aujourd''hui', 'favorite_event_today'),
    (2, 'Reinitialisation de mot de passe', 'password_reset_requested'),
    (3, 'Mot de passe modifie', 'password_changed'),
    (4, 'Compte organisation valide', 'organization_approved'),
    (5, 'Evenement valide', 'event_approved'),
    (6, 'Email de bienvenue', 'welcome_email'),
    (7, 'Compte organisation refuse', 'organization_rejected'),
    (8, 'Evenement refuse', 'event_rejected'),
    (9, 'Evenement masque', 'event_hidden'),
    (10, 'Evenement supprime', 'event_deleted'),
    (11, 'Compte suspendu', 'account_suspended'),
    (12, 'Decision moderation', 'moderation_decision')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();

SELECT setval(
    pg_get_serial_sequence('notification_types', 'id'),
    (SELECT MAX(id) FROM notification_types)
);

CREATE TABLE IF NOT EXISTS notifications (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id              BIGINT REFERENCES events(id) ON DELETE SET NULL,
    organization_id       BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    notification_type_id  INTEGER NOT NULL REFERENCES notification_types(id),
    title                 VARCHAR(150) NOT NULL,
    message               TEXT NOT NULL,
    is_read               BOOLEAN NOT NULL DEFAULT FALSE,
    read_at               TIMESTAMP,
    action_url            TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_reports (
    id                    BIGSERIAL PRIMARY KEY,
    target_type           VARCHAR(20) NOT NULL,
    target_id             BIGINT NOT NULL,
    reporter_user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason                VARCHAR(150) NOT NULL,
    details               TEXT NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'open',
    priority              VARCHAR(20) NOT NULL DEFAULT 'medium',
    handled_by_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolution_note       TEXT,
    resolved_at           TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_moderation_reports_target_type
        CHECK (target_type IN ('event', 'organization', 'account')),
    CONSTRAINT chk_moderation_reports_status
        CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    CONSTRAINT chk_moderation_reports_priority
        CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status_priority
ON moderation_reports(status, priority, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_reports_open_unique
ON moderation_reports(target_type, target_id, reporter_user_id)
WHERE status IN ('open', 'reviewing');

CREATE TABLE IF NOT EXISTS moderation_decisions (
    id                  BIGSERIAL PRIMARY KEY,
    action              VARCHAR(50) NOT NULL,
    target_type         VARCHAR(20) NOT NULL,
    target_id           BIGINT NOT NULL,
    moderator_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason              TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_moderation_decisions_target_type
        CHECK (target_type IN ('event', 'organization', 'account'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_target
ON moderation_decisions(target_type, target_id, created_at DESC);

COMMIT;
