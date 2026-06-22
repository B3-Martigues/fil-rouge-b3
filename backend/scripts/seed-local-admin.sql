WITH upsert_account AS (
    INSERT INTO accounts (account_type_id, login_email, password_hash, is_active)
    SELECT
        account_types.id,
        'admin@mappening.local',
        '$2a$10$OF8SaEuOlrf4eFy365SA.eN5jCZ1lkje/NljP9rT5WMabYJq9pV4q',
        TRUE
    FROM account_types
    WHERE account_types.slug = 'admin'
    ON CONFLICT ((LOWER(login_email))) WHERE deleted_at IS NULL DO UPDATE
    SET
        account_type_id = EXCLUDED.account_type_id,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE,
        deleted_at = NULL,
        updated_at = NOW()
    RETURNING id
)
INSERT INTO users (account_id, username, role_id)
SELECT upsert_account.id, 'Admin Local', roles.id
FROM upsert_account
JOIN roles ON roles.slug = 'admin'
ON CONFLICT (account_id) DO UPDATE
SET
    username = EXCLUDED.username,
    role_id = EXCLUDED.role_id,
    deleted_at = NULL,
    updated_at = NOW();
