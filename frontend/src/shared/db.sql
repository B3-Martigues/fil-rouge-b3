-- Account Types
CREATE TABLE account_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    slug VARCHAR(20) NOT NULL UNIQUE
);

-- Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    slug VARCHAR(20) NOT NULL UNIQUE
);

-- Event Categories
CREATE TABLE event_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO event_categories (id, name, slug) VALUES
    (1, 'animaux', 'animaux'),
    (2, 'art', 'art'),
    (3, 'associatif', 'associatif'),
    (4, 'atelier', 'atelier'),
    (5, 'automobile', 'automobile'),
    (6, 'bien-etre', 'bien-etre'),
    (7, 'business', 'business'),
    (8, 'cinema', 'cinema'),
    (9, 'concert', 'concert'),
    (10, 'conference', 'conference'),
    (11, 'culture', 'culture'),
    (12, 'emploi', 'emploi'),
    (13, 'enfants', 'enfants'),
    (14, 'esport', 'esport'),
    (15, 'famille', 'famille'),
    (16, 'festival', 'festival'),
    (17, 'food', 'food'),
    (18, 'formation', 'formation'),
    (19, 'gaming', 'gaming'),
    (20, 'gastronomie', 'gastronomie'),
    (21, 'humour', 'humour'),
    (22, 'jeux', 'jeux'),
    (23, 'marche', 'marche'),
    (24, 'mode', 'mode'),
    (25, 'musique', 'musique'),
    (26, 'nature', 'nature'),
    (27, 'networking', 'networking'),
    (28, 'nightlife', 'nightlife'),
    (29, 'patrimoine', 'patrimoine'),
    (30, 'plein-air', 'plein-air'),
    (31, 'randonnee', 'randonnee'),
    (32, 'sante', 'sante'),
    (33, 'shopping', 'shopping'),
    (34, 'solidarite', 'solidarite'),
    (35, 'soiree', 'soiree'),
    (36, 'spectacle', 'spectacle'),
    (37, 'sport', 'sport'),
    (38, 'technologie', 'technologie'),
    (39, 'theatre', 'theatre'),
    (40, 'tourisme', 'tourisme'),
    (41, 'etudiant', 'etudiant'),
    (42, 'exposition', 'exposition');

SELECT setval(
    pg_get_serial_sequence('event_categories', 'id'),
    (SELECT MAX(id) FROM event_categories)
);

-- Organization Categories
CREATE TABLE organization_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

-- Notification Types
CREATE TABLE notification_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO notification_types (name, slug) VALUES
    ('Decision moderation', 'moderation_decision')
ON CONFLICT (slug) DO NOTHING;

-- Accounts
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_type_id INT NOT NULL REFERENCES account_types(id),
    login_email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_changed_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE,
    role_id INT NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Organizations
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(90) NOT NULL,
    contact_email VARCHAR(150) NOT NULL UNIQUE,
    role_id INT REFERENCES roles(id),
    description TEXT,
    website VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    logo VARCHAR(255),
    contact_phone_number VARCHAR(20),
    siret VARCHAR(50) UNIQUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Organization Members
CREATE TABLE organizers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_role VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (user_id, organization_id)
);

-- Organization Categories Links
CREATE TABLE organization_categories_links (
    id SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_category_id INT NOT NULL REFERENCES organization_categories(id) ON DELETE CASCADE,
    UNIQUE (organization_id, organization_category_id)
);

-- Events
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    image VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    ticketing_link TEXT NOT NULL DEFAULT '',
    source TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CHECK (price >= 0),
    CHECK (end_date >= start_date)
);

-- Event Categories Links
CREATE TABLE event_categories_links (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_category_id INT NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    UNIQUE (event_id, event_category_id)
);

-- User Event Preferences
CREATE TABLE user_event_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_category_id INT NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    UNIQUE (user_id, event_category_id)
);

-- Favorites
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (user_id, event_id)
);

-- Histories
CREATE TABLE histories (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    organization_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    notification_type_id INT NOT NULL REFERENCES notification_types(id),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    action_url VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
