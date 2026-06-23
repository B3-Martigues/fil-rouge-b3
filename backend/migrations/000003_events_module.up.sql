BEGIN;

CREATE TABLE IF NOT EXISTS event_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
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
    (42, 'exposition', 'exposition')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();

SELECT setval(pg_get_serial_sequence('event_categories', 'id'), (SELECT MAX(id) FROM event_categories));

CREATE TABLE IF NOT EXISTS events (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    description     TEXT NOT NULL,
    start_date      TIMESTAMP NOT NULL,
    end_date        TIMESTAMP NOT NULL,
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    address         TEXT NOT NULL,
    city            VARCHAR(50) NOT NULL,
    postal_code     VARCHAR(10) NOT NULL,
    image           VARCHAR(255) NOT NULL,
    price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    ticketing_link  TEXT NOT NULL DEFAULT '',
    source          TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,

    CONSTRAINT chk_events_price_non_negative CHECK (price >= 0),
    CONSTRAINT chk_events_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_events_public
ON events(is_active, deleted_at, start_date);

CREATE INDEX IF NOT EXISTS idx_events_organization
ON events(organization_id);

CREATE INDEX IF NOT EXISTS idx_events_city_postal_code
ON events(LOWER(city), postal_code);

CREATE INDEX IF NOT EXISTS idx_events_geo
ON events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS event_categories_links (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_category_id   INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
    UNIQUE (event_id, event_category_id)
);

CREATE INDEX IF NOT EXISTS idx_event_categories_links_category
ON event_categories_links(event_category_id);

CREATE TABLE IF NOT EXISTS favorites (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMP,
    UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_active
ON favorites(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_favorites_event_active
ON favorites(event_id, deleted_at);

CREATE TABLE IF NOT EXISTS histories (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    visited_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_histories_user_visited
ON histories(user_id, deleted_at, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_histories_event
ON histories(event_id);

COMMIT;
