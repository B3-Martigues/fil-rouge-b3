# Environnements de deploiement

Ce guide explique comment separer `dev`, `staging` et `production`.

L'objectif est d'eviter qu'un environnement local utilise les secrets ou la base
de production.

## Ressources a separer

Chaque environnement doit avoir :

- une base PostgreSQL dediee
- un role applicatif dedie
- un role de migration dedie
- un `JWT_SECRET` dedie
- une origine client dediee pour CORS et CSRF
- un domaine CSRF dedie si le front et l'API sont sur des sous-domaines separes
- un dossier d'uploads persistant dedie

Ne pas partager :

- la base de production avec le developpement local
- le secret JWT de production avec un autre environnement
- les mots de passe PostgreSQL entre plusieurs environnements

## Strategie recommandee

- `dev` : poste local, `.env.local`, base locale
- `staging` : environnement de validation, secrets dedies, base dediee
- `production` : environnement public, secrets dedies, base dediee

Le backend charge automatiquement `.env.local` uniquement en environnement de
developpement. En staging et production, les variables doivent etre injectees
par l'hebergeur, Docker, systemd ou un gestionnaire de secrets.

## Base PostgreSQL

Le projet distingue deux familles de variables :

- `APP_DB_*` : connexion utilisee par l'API
- `MIGRATIONS_DB_*` : connexion utilisee pour modifier le schema

Le role applicatif ne doit pas posseder les droits de schema les plus eleves.

## Creation d'une base

Un exemple est fourni dans
[`../postgres-production-bootstrap.sql.example`](../postgres-production-bootstrap.sql.example).

Procedure :

1. Copier l'exemple hors du depot.
2. Remplacer les noms et mots de passe.
3. Executer le script avec un compte PostgreSQL administrateur.
4. Reporter les valeurs dans les variables `APP_DB_*` et `MIGRATIONS_DB_*`.

Points importants :

- `APP_DB_NAME` et `MIGRATIONS_DB_NAME` pointent vers la meme base.
- `APP_DB_USER` correspond au role applicatif.
- `MIGRATIONS_DB_USER` correspond au role de migration.
- `APP_DB_SSLMODE` et `MIGRATIONS_DB_SSLMODE` peuvent etre `disable` uniquement
  si PostgreSQL ecoute en loopback sur le meme VPS.
- pour une base distante, utiliser `require`, `verify-ca` ou `verify-full`.

## Migrations

Depuis `backend/` :

```bash
go run ./cmd/migrate
```

Flux recommande :

1. Creer la base et les roles.
2. Injecter les variables `MIGRATIONS_DB_*`.
3. Lancer les migrations.
4. Verifier que le schema est present.
5. Demarrer l'API avec les variables `APP_DB_*`.

## Frontend same-origin

Pour `https://mappening.fr`, le deploiement recommande sert le frontend et l'API
sur la meme origine :

- frontend statique : `/`
- API Go : `/api`
- medias : `/uploads`

Dans ce mode, laisser `frontend/.env` avec :

```env
VITE_API_BASE_URL=
```

Le reverse proxy doit servir `sw.js` avec `Cache-Control: no-cache` et les assets
hashes Vite avec un cache long.

## Uploads

En production, ne pas stocker les uploads dans le dossier de release Git.
Configurer par exemple :

```env
MEDIA_UPLOAD_DIR=/var/lib/mappening/uploads
```

Le dossier doit appartenir a l'utilisateur qui execute l'API et etre inclus dans
les sauvegardes.

## Premier admin

Generer un hash bcrypt depuis `backend/` :

```bash
go run ./hash_password.go
```

Inserer ensuite le compte administrateur :

```sql
WITH account AS (
    INSERT INTO accounts (account_type_id, login_email, password_hash, is_active)
    SELECT id, 'admin@example.mappening.fr', '$2a$replace-with-bcrypt-hash', TRUE
    FROM account_types
    WHERE slug = 'admin'
    RETURNING id
)
INSERT INTO users (account_id, username, role_id)
SELECT account.id, 'Admin Mappening', roles.id
FROM account
JOIN roles ON roles.slug = 'admin';
```

## Checklist production

1. `ENV=production`
2. `FRONTEND_URL` en `https://...`
3. `COOKIE_SECURE=true`
4. `CSRF_COOKIE_DOMAIN` vide ou limite a un domaine parent controle
5. `DEV_LOGIN_ENABLED=false`
6. `TRUSTED_PROXY_CIDRS` limite aux reverse proxies
7. `PUBLIC_DOCS_ENABLED=false` sauf besoin explicite
8. `MEDIA_UPLOAD_DIR` vers un dossier persistant sauvegarde
9. Reverse proxy configure pour reecrire `X-Forwarded-*`
10. Base production dediee
11. Sauvegardes configurees
12. Migrations executees avant le demarrage de l'API
13. Premier compte admin cree manuellement
