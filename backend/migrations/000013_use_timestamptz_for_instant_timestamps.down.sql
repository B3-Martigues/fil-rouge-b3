BEGIN;

CREATE OR REPLACE FUNCTION migrate_timestamptz_to_timestamp(
    table_name REGCLASS,
    column_name TEXT,
    default_expression TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP DEFAULT', table_name, column_name);
    EXECUTE format(
        'ALTER TABLE %s ALTER COLUMN %I TYPE TIMESTAMP USING %I AT TIME ZONE %L',
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

SELECT migrate_timestamptz_to_timestamp('account_types', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('account_types', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('roles', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('roles', 'updated_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('accounts', 'password_changed_at');
SELECT migrate_timestamptz_to_timestamp('accounts', 'suspended_until');
SELECT migrate_timestamptz_to_timestamp('accounts', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('accounts', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('accounts', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('users', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('users', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('users', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('organizations', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('organizations', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('organizations', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('organizers', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('organizers', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('organizers', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('auth_refresh_tokens', 'expires_at');
SELECT migrate_timestamptz_to_timestamp('auth_refresh_tokens', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('http_rate_limits', 'window_started_at');
SELECT migrate_timestamptz_to_timestamp('http_rate_limits', 'updated_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('event_categories', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('event_categories', 'updated_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('events', 'suspended_until');
SELECT migrate_timestamptz_to_timestamp('events', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('events', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('events', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('favorites', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('favorites', 'deleted_at');
SELECT migrate_timestamptz_to_timestamp('histories', 'visited_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('histories', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('organization_categories', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('organization_categories', 'updated_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('notification_types', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('notification_types', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('notifications', 'read_at');
SELECT migrate_timestamptz_to_timestamp('notifications', 'created_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('moderation_reports', 'resolved_at');
SELECT migrate_timestamptz_to_timestamp('moderation_reports', 'created_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('moderation_reports', 'updated_at', 'NOW()');
SELECT migrate_timestamptz_to_timestamp('moderation_decisions', 'created_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp('media', 'created_at', 'CURRENT_TIMESTAMP');
SELECT migrate_timestamptz_to_timestamp('media', 'deleted_at');

SELECT migrate_timestamptz_to_timestamp('password_reset_tokens', 'expires_at');
SELECT migrate_timestamptz_to_timestamp('password_reset_tokens', 'used_at');
SELECT migrate_timestamptz_to_timestamp('password_reset_tokens', 'created_at', 'NOW()');

SELECT migrate_timestamptz_to_timestamp(
    'user_event_preferences',
    'created_at',
    '(CURRENT_TIMESTAMP AT TIME ZONE ''Europe/Paris'')'
);

DROP FUNCTION migrate_timestamptz_to_timestamp(REGCLASS, TEXT, TEXT);

COMMIT;
