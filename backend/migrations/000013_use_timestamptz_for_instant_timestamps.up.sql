BEGIN;

CREATE OR REPLACE FUNCTION migrate_timestamp_to_timestamptz(
    table_name REGCLASS,
    column_name TEXT,
    default_expression TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP DEFAULT', table_name, column_name);
    EXECUTE format(
        'ALTER TABLE %s ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE %L',
        table_name,
        column_name,
        column_name,
        'Europe/Paris'
    );

    IF default_expression IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s', table_name, column_name, default_expression);
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_timestamp_to_timestamptz('account_types', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('account_types', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('roles', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('roles', 'updated_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('accounts', 'password_changed_at');
SELECT migrate_timestamp_to_timestamptz('accounts', 'suspended_until');
SELECT migrate_timestamp_to_timestamptz('accounts', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('accounts', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('accounts', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('users', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('users', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('users', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('organizations', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('organizations', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('organizations', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('organizers', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('organizers', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('organizers', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('auth_refresh_tokens', 'expires_at');
SELECT migrate_timestamp_to_timestamptz('auth_refresh_tokens', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('http_rate_limits', 'window_started_at');
SELECT migrate_timestamp_to_timestamptz('http_rate_limits', 'updated_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('event_categories', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('event_categories', 'updated_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('events', 'suspended_until');
SELECT migrate_timestamp_to_timestamptz('events', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('events', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('events', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('favorites', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('favorites', 'deleted_at');
SELECT migrate_timestamp_to_timestamptz('histories', 'visited_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('histories', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('organization_categories', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('organization_categories', 'updated_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('notification_types', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('notification_types', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('notifications', 'read_at');
SELECT migrate_timestamp_to_timestamptz('notifications', 'created_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('moderation_reports', 'resolved_at');
SELECT migrate_timestamp_to_timestamptz('moderation_reports', 'created_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('moderation_reports', 'updated_at', 'NOW()');
SELECT migrate_timestamp_to_timestamptz('moderation_decisions', 'created_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('media', 'created_at', 'CURRENT_TIMESTAMP');
SELECT migrate_timestamp_to_timestamptz('media', 'deleted_at');

SELECT migrate_timestamp_to_timestamptz('password_reset_tokens', 'expires_at');
SELECT migrate_timestamp_to_timestamptz('password_reset_tokens', 'used_at');
SELECT migrate_timestamp_to_timestamptz('password_reset_tokens', 'created_at', 'NOW()');

SELECT migrate_timestamp_to_timestamptz('user_event_preferences', 'created_at', 'NOW()');

DROP FUNCTION migrate_timestamp_to_timestamptz(REGCLASS, TEXT, TEXT);

COMMIT;
