BEGIN;

CREATE TABLE IF NOT EXISTS organization_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO organization_categories (id, name, slug) VALUES
    (1, 'art', 'art'),
    (2, 'associatif', 'associatif'),
    (3, 'bien-etre', 'bien-etre'),
    (4, 'business', 'business'),
    (5, 'culture', 'culture'),
    (6, 'famille', 'famille'),
    (7, 'formation', 'formation'),
    (8, 'gaming', 'gaming'),
    (9, 'gastronomie', 'gastronomie'),
    (10, 'musique', 'musique'),
    (11, 'nature', 'nature'),
    (12, 'sport', 'sport'),
    (13, 'soiree', 'soiree'),
    (14, 'technologie', 'technologie'),
    (15, 'tourisme', 'tourisme')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();

SELECT setval(
    pg_get_serial_sequence('organization_categories', 'id'),
    (SELECT MAX(id) FROM organization_categories)
);

CREATE TABLE IF NOT EXISTS organization_categories_links (
    id                         BIGSERIAL PRIMARY KEY,
    organization_id            BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_category_id   INTEGER NOT NULL REFERENCES organization_categories(id) ON DELETE CASCADE,
    UNIQUE (organization_id, organization_category_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_categories_links_category
ON organization_categories_links(organization_category_id);

CREATE INDEX IF NOT EXISTS idx_organization_categories_links_organization
ON organization_categories_links(organization_id);

COMMIT;
