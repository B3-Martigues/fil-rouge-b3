INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
    'admin@mappening.local',
    '$2a$10$OF8SaEuOlrf4eFy365SA.eN5jCZ1lkje/NljP9rT5WMabYJq9pV4q',
    'Admin',
    'Local',
    'admin',
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_active = TRUE,
    updated_at = NOW();
