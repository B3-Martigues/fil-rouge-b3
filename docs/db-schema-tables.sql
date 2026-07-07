-- PostgreSQL schema only, generated from backend/migrations/*.up.sql
-- Data inserts from reference/seed tables are intentionally excluded.

CREATE TABLE account_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    slug VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    slug VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
    id BIGSERIAL PRIMARY KEY,
    account_type_id INTEGER NOT NULL REFERENCES account_types(id),
    login_email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    password_changed_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    suspended_until TIMESTAMPTZ,
    suspension_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_accounts_login_email_active
ON accounts (LOWER(login_email))
WHERE deleted_at IS NULL;

CREATE INDEX idx_accounts_deleted_at
ON accounts(deleted_at);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_username_active
ON users (LOWER(username))
WHERE deleted_at IS NULL;

CREATE INDEX idx_users_account_id
ON users(account_id);

CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(90) NOT NULL,
    contact_email VARCHAR(150) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    description TEXT,
    website VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    logo VARCHAR(255),
    contact_phone_number VARCHAR(20),
    siret VARCHAR(50),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_organizations_contact_email_active
ON organizations (LOWER(contact_email))
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_organizations_siret_active
ON organizations (LOWER(siret))
WHERE deleted_at IS NULL AND siret IS NOT NULL AND siret <> '';

CREATE TABLE organizers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_role VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, organization_id)
);

CREATE TABLE auth_refresh_tokens (
    subject VARCHAR(255) PRIMARY KEY,
    jti VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_refresh_tokens_expires_at
ON auth_refresh_tokens(expires_at);

CREATE TABLE http_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_http_rate_limits_request_count CHECK (request_count > 0)
);

CREATE INDEX idx_http_rate_limits_updated_at
ON http_rate_limits(updated_at);

CREATE TABLE event_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    image TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    ticketing_link TEXT DEFAULT '',
    source TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    suspended_until TIMESTAMPTZ,
    suspension_reason TEXT,
    source_url TEXT,
    time_start TIME,
    time_end TIME,
    external_image_url TEXT,
    image_optimized_url TEXT,
    image_thumbnail_url TEXT,
    CONSTRAINT chk_events_price_non_negative CHECK (price >= 0),
    CONSTRAINT chk_events_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX idx_events_public
ON events(is_active, deleted_at, start_date);

CREATE INDEX idx_events_organization
ON events(organization_id);

CREATE INDEX idx_events_city_postal_code
ON events(LOWER(city), postal_code);

CREATE INDEX idx_events_geo
ON events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_events_source_url_unique
ON events(source_url)
WHERE source_url IS NOT NULL;

CREATE INDEX idx_events_external_image_url
ON events(external_image_url)
WHERE external_image_url IS NOT NULL;

CREATE TABLE event_categories_links (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_category_id INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    UNIQUE (event_id, event_category_id)
);

CREATE INDEX idx_event_categories_links_category
ON event_categories_links(event_category_id);

CREATE TABLE favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, event_id)
);

CREATE INDEX idx_favorites_user_active
ON favorites(user_id, deleted_at);

CREATE INDEX idx_favorites_event_active
ON favorites(event_id, deleted_at);

CREATE TABLE histories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_histories_user_visited
ON histories(user_id, deleted_at, visited_at DESC);

CREATE INDEX idx_histories_event
ON histories(event_id);

CREATE TABLE organization_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_categories_links (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_category_id INTEGER NOT NULL REFERENCES organization_categories(id) ON DELETE CASCADE,
    UNIQUE (organization_id, organization_category_id)
);

CREATE INDEX idx_organization_categories_links_category
ON organization_categories_links(organization_category_id);

CREATE INDEX idx_organization_categories_links_organization
ON organization_categories_links(organization_id);

CREATE TABLE notification_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    notification_type_id INTEGER NOT NULL REFERENCES notification_types(id),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read
ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE moderation_reports (
    id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    reporter_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(150) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    handled_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_moderation_reports_target_type CHECK (target_type IN ('event', 'organization', 'account')),
    CONSTRAINT chk_moderation_reports_status CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    CONSTRAINT chk_moderation_reports_priority CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_moderation_reports_status_priority
ON moderation_reports(status, priority, created_at DESC);

CREATE UNIQUE INDEX idx_moderation_reports_open_unique
ON moderation_reports(target_type, target_id, reporter_user_id)
WHERE status IN ('open', 'reviewing');

CREATE TABLE moderation_decisions (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    moderator_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_id BIGINT REFERENCES moderation_reports(id) ON DELETE SET NULL,
    CONSTRAINT chk_moderation_decisions_target_type CHECK (target_type IN ('event', 'organization', 'account'))
);

CREATE INDEX idx_moderation_decisions_target
ON moderation_decisions(target_type, target_id, created_at DESC);

CREATE INDEX idx_moderation_decisions_report
ON moderation_decisions(report_id);

CREATE TABLE media (
    id BIGSERIAL PRIMARY KEY,
    owner_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    public_url VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_media_entity_type CHECK (entity_type IN ('organization', 'event')),
    CONSTRAINT chk_media_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX idx_media_owner_active
ON media(owner_account_id, deleted_at);

CREATE INDEX idx_media_entity_active
ON media(entity_type, entity_id, deleted_at);

CREATE UNIQUE INDEX idx_media_public_url
ON media(public_url);

CREATE TABLE password_reset_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_account
ON password_reset_tokens(account_id, created_at DESC);

CREATE TABLE user_event_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_category_id INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_category_id)
);

CREATE INDEX idx_user_event_preferences_user
ON user_event_preferences(user_id);
