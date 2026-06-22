BEGIN;

DO $$
BEGIN
    IF to_regclass('public.accounts') IS NULL AND to_regclass('public.users') IS NOT NULL THEN
        ALTER TABLE users RENAME TO legacy_users;

        CREATE TABLE account_types (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(20) NOT NULL UNIQUE,
            slug        VARCHAR(20) NOT NULL UNIQUE,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
        );

        INSERT INTO account_types (id, name, slug) VALUES
            (1, 'Utilisateur', 'user'),
            (2, 'Administrateur', 'admin'),
            (3, 'Organisation', 'organization'),
            (4, 'Moderateur', 'moderator');

        PERFORM setval(pg_get_serial_sequence('account_types', 'id'), (SELECT MAX(id) FROM account_types));

        CREATE TABLE roles (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(20) NOT NULL UNIQUE,
            slug        VARCHAR(20) NOT NULL UNIQUE,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
        );

        INSERT INTO roles (id, name, slug) VALUES
            (1, 'Utilisateur', 'user'),
            (2, 'Administrateur', 'admin'),
            (3, 'Organisation', 'organization'),
            (4, 'Moderateur', 'moderator');

        PERFORM setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));

        CREATE TABLE accounts (
            id                    BIGSERIAL PRIMARY KEY,
            account_type_id       INTEGER NOT NULL REFERENCES account_types(id),
            login_email           VARCHAR(150) NOT NULL,
            password_hash         TEXT NOT NULL,
            password_changed_at   TIMESTAMP,
            is_active             BOOLEAN NOT NULL DEFAULT TRUE,
            suspended_until       TIMESTAMP,
            suspension_reason     TEXT,
            created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at            TIMESTAMP
        );

        CREATE UNIQUE INDEX idx_accounts_login_email_active
        ON accounts (LOWER(login_email))
        WHERE deleted_at IS NULL;

        CREATE INDEX idx_accounts_deleted_at
        ON accounts(deleted_at);

        CREATE TABLE users (
            id          BIGSERIAL PRIMARY KEY,
            account_id  BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
            username    VARCHAR(100) NOT NULL,
            role_id     INTEGER NOT NULL REFERENCES roles(id),
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at  TIMESTAMP
        );

        CREATE UNIQUE INDEX idx_users_username_active
        ON users (LOWER(username))
        WHERE deleted_at IS NULL;

        CREATE INDEX idx_users_account_id
        ON users(account_id);

        CREATE TABLE organizations (
            id                    BIGSERIAL PRIMARY KEY,
            account_id            BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
            name                  VARCHAR(90) NOT NULL,
            contact_email         VARCHAR(150) NOT NULL,
            role_id               INTEGER REFERENCES roles(id),
            description           TEXT,
            website               VARCHAR(255),
            latitude              DECIMAL(9,6),
            longitude             DECIMAL(9,6),
            address               TEXT NOT NULL,
            city                  VARCHAR(50) NOT NULL,
            postal_code           VARCHAR(10) NOT NULL,
            logo                  VARCHAR(255),
            contact_phone_number  VARCHAR(20),
            siret                 VARCHAR(50),
            is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
            is_active             BOOLEAN NOT NULL DEFAULT TRUE,
            created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at            TIMESTAMP
        );

        CREATE UNIQUE INDEX idx_organizations_contact_email_active
        ON organizations (LOWER(contact_email))
        WHERE deleted_at IS NULL;

        CREATE UNIQUE INDEX idx_organizations_siret_active
        ON organizations (LOWER(siret))
        WHERE deleted_at IS NULL AND siret IS NOT NULL AND siret <> '';

        CREATE TABLE organizers (
            id               BIGSERIAL PRIMARY KEY,
            user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            job_role         VARCHAR(50),
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at       TIMESTAMP,
            UNIQUE (user_id, organization_id)
        );

        INSERT INTO accounts (id, account_type_id, login_email, password_hash, is_active, created_at, updated_at)
        SELECT
            legacy_users.id,
            account_types.id,
            legacy_users.email,
            legacy_users.password_hash,
            legacy_users.is_active,
            legacy_users.created_at,
            legacy_users.updated_at
        FROM legacy_users
        JOIN account_types ON account_types.slug = legacy_users.role;

        INSERT INTO users (account_id, username, role_id, created_at, updated_at)
        SELECT
            legacy_users.id,
            LEFT(
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(legacy_users.first_name, ''), ' ', COALESCE(legacy_users.last_name, ''))), ''),
                    SPLIT_PART(legacy_users.email, '@', 1)
                ) || '-' || legacy_users.id,
                100
            ),
            roles.id,
            legacy_users.created_at,
            legacy_users.updated_at
        FROM legacy_users
        JOIN roles ON roles.slug = legacy_users.role;

        PERFORM setval(
            pg_get_serial_sequence('accounts', 'id'),
            COALESCE((SELECT MAX(id) FROM accounts), 1),
            (SELECT COUNT(*) > 0 FROM accounts)
        );
        PERFORM setval(
            pg_get_serial_sequence('users', 'id'),
            COALESCE((SELECT MAX(id) FROM users), 1),
            (SELECT COUNT(*) > 0 FROM users)
        );

        DROP TABLE legacy_users;
    END IF;
END $$;

COMMIT;
