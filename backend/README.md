# Backend Mappening

Backend Go du projet Mappening.

Il expose une API HTTP sous `/api/*` et fournit le socle serveur du projet : authentification, utilisateurs, organisations, événements, favoris, historique, médias, notifications, modération, scraping, cache Redis, sécurité HTTP et accès PostgreSQL.

## État actuel

Le backend est branché sur PostgreSQL et Redis. Au démarrage, l'API :

- charge `backend/.env.local` en développement ;
- valide la configuration ;
- ouvre la connexion PostgreSQL applicative ;
- initialise Redis ;
- démarre le scheduler de scraping Tarpin Bien si `TARPIN_BIEN_SCRAPER_ENABLED=true` ;
- expose les routes HTTP et sert les fichiers de `uploads/`.

Depuis les dernières versions, le périmètre backend inclut :

- les modules événements, catégories, favoris et historique ;
- les organisations, catégories, membres et statuts de validation ;
- les endpoints staff pour les comptes, organisations, événements, signalements, décisions et notifications ;
- l'upload d'images d'événements et de logos d'organisations ;
- le géocodage et l'autocomplétion d'adresse ;
- le scraping Tarpin Bien avec import d'événements externes et récupération d'images ;
- le cache Redis sur les lectures d'événements ;
- les refresh tokens persistés, la protection CSRF, les headers de sécurité et le rate limiting.

## Prérequis

- Go 1.25
- Docker Desktop, ou PostgreSQL et Redis installés localement
- PostgreSQL 16 recommandé
- Redis 7 recommandé
- une base applicative
- un rôle applicatif
- un rôle de migration séparé

## Démarrage local

Chaque membre de l'équipe travaille avec sa propre base PostgreSQL locale. Les migrations et les scripts de seed sont versionnés, mais `backend/.env.local` et les données PostgreSQL/Redis restent locaux et ne doivent pas être commit.

Depuis la racine du repo, une commande prépare la base locale puis lance l'API :

```powershell
.\start-backend.ps1
```

Si vous ne voulez pas remettre à jour les données de seed au démarrage :

```powershell
.\start-backend.ps1 -SkipSeed
```

Le script crée `backend/.env.local` si besoin, démarre PostgreSQL, attend le healthcheck Docker, lance les migrations, seed l'admin local et les événements locaux, puis démarre l'API.

Redis est nécessaire au lancement de l'API. Si le conteneur Redis n'est pas encore lancé :

```powershell
docker compose up -d redis
```

Pour préparer uniquement la base sans lancer l'API :

```powershell
.\backend\scripts\setup-local-db.ps1
```

### Démarrage manuel

Depuis la racine du repo :

```powershell
docker compose up -d postgres redis
```

Dans `backend/`, copier le modèle d'environnement si besoin :

```powershell
Copy-Item .env.example .env.local
```

Renseigner ensuite les variables PostgreSQL, Redis si nécessaire, et les secrets dans `.env.local`. Ce fichier reste local et ne doit pas être commit.

Lancer les migrations :

```powershell
go run ./cmd/migrate
```

Créer ou remettre à jour les données locales :

```powershell
Get-Content -Raw .\scripts\seed-local-admin.sql | docker exec -i mappening-postgres psql "postgres://mappening_migrator:mappening_migrator_password@localhost:5432/mappening?sslmode=disable"
Get-Content -Raw .\scripts\seed-local-events.sql | docker exec -i mappening-postgres psql "postgres://mappening_migrator:mappening_migrator_password@localhost:5432/mappening?sslmode=disable"
```

Identifiants locaux :

- email : `admin@mappening.local`
- mot de passe : `AdminPassword123!`

Lancer l'API :

```powershell
go run ./cmd/api
```

En développement, l'API écoute par défaut sur `127.0.0.1:8080`.

## Configuration

Le fichier de référence est [`backend/.env.example`](.env.example). En local, il est copié vers `.env.local`.

Variables importantes :

- `ENV`, `ADDR`, `FRONTEND_URL`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_TTL`, `REFRESH_TTL`
- `COOKIE_SECURE`, `CSRF_COOKIE_DOMAIN`
- `DEV_LOGIN_ENABLED`, `DEV_LOGIN_EMAIL`
- `APP_DB_*`
- `MIGRATIONS_DB_*`
- `TRUSTED_PROXY_CIDRS`
- `MAIL_MODE`, `MAIL_FROM`, `SMTP_*`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` si vous voulez surcharger les valeurs par défaut
- `TARPIN_BIEN_SCRAPER_ENABLED`

En développement, Redis utilise par défaut `127.0.0.1:6379`, sans mot de passe, DB `0`.

## Emails

Les emails sortants sont gérés côté backend. En local, `MAIL_MODE=log` écrit les messages dans les logs. Pour envoyer réellement :

```text
MAIL_MODE=smtp
MAIL_FROM=no-reply@votre-domaine.fr
MAIL_FROM_NAME=Mappening
SMTP_HOST=smtp.votre-fournisseur.fr
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
```

Les emails de bienvenue, de réinitialisation de mot de passe, de changement de mot de passe et de décisions de modération utilisent cette configuration.

## Scraping Tarpin Bien

Le scraping peut être lancé automatiquement par l'API ou manuellement via une commande dédiée.

Lancement manuel depuis `backend/` :

```powershell
go run ./cmd/scrape-tarpin-bien
```

Le job importe ou met à jour les événements externes, conserve l'URL source, normalise les données utiles et peut récupérer des images distantes. Le scheduler HTTP est contrôlé par `TARPIN_BIEN_SCRAPER_ENABLED`.

## Connexion pgAdmin locale

Connexion administrateur PostgreSQL :

```text
Host: localhost
Port: 55432
Maintenance database: postgres
Username: postgres
Password: postgres
```

Connexion applicative, identique à celle utilisée par l'API :

```text
Host: localhost
Port: 55432
Maintenance database: mappening
Username: mappening_user
Password: mappening_app_password
```

Pour vérifier la connexion dans le Query Tool pgAdmin :

```sql
SELECT current_database(), current_user, now();
```

Si la connexion API fonctionne, le lancement de `go run ./cmd/api` affiche :

```text
application database connected
redis connected
```

## Commandes utiles

Depuis `backend/` :

```powershell
go test -count=1 ./...
go build ./...
go vet ./...
govulncheck ./...
go run ./cmd/migrate
go run ./cmd/api
go run ./cmd/scrape-tarpin-bien
go run ./hash_password.go
```

`hash_password.go` lit le mot de passe sur l'entrée standard afin d'éviter de le laisser dans l'historique shell ou la liste des processus.

## Routes principales

### Santé

- `GET /api/health`
- `GET /api/health/db` avec rôle `admin`

### Authentification, profil et compte

- `POST /api/auth/login`
- `POST /api/auth/login/dev`
- `POST /api/auth/register/user`
- `POST /api/auth/register/organization`
- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `PATCH /api/auth/password`
- `GET /api/auth/check-role/{role}`
- `GET /api/auth/check-account-type/{accountType}`
- `PATCH /api/auth/deactivate`
- `DELETE /api/auth/account`

### Préférences et notifications utilisateur

- `GET /api/me/preferences`
- `PUT /api/me/preferences`
- `GET /api/notification-types`
- `GET /api/me/notifications`
- `PATCH /api/me/notifications/read`
- `PATCH /api/me/notifications/{notificationID}/read`

### Événements

- `GET /api/events`
- `GET /api/events/upcoming`
- `GET /api/events/past`
- `GET /api/events/popular`
- `GET /api/events/map`
- `GET /api/events/{eventID}`
- `GET /api/organizations/{organizationID}/events`
- `POST /api/events`
- `PUT /api/events/{eventID}`
- `PATCH /api/events/{eventID}`
- `DELETE /api/events/{eventID}`
- `PATCH /api/events/{eventID}/active`
- `GET /api/event-categories`
- `GET /api/event-categories/{categoryID}`
- `GET /api/event-categories/{categoryID}/events`
- `PUT /api/events/{eventID}/categories`
- `POST /api/events/{eventID}/categories/{categoryID}`
- `DELETE /api/events/{eventID}/categories/{categoryID}`

### Favoris et historique

- `GET /api/events/{eventID}/favorite`
- `POST /api/events/{eventID}/favorite`
- `DELETE /api/events/{eventID}/favorite`
- `GET /api/me/favorites`
- `POST /api/events/{eventID}/history`
- `GET /api/me/history`
- `DELETE /api/me/history/{historyID}`

### Organisations

- `GET /api/organizations`
- `GET /api/organizations/{organizationID}`
- `GET /api/organization-categories`
- `GET /api/organizations/me`
- `GET /api/me/organizations`
- `GET /api/users/{userID}/organizations`
- `POST /api/organizations`
- `PUT /api/organizations/{organizationID}`
- `PATCH /api/organizations/{organizationID}`
- `PATCH /api/organizations/{organizationID}/status`
- `PATCH /api/organizations/{organizationID}/active`
- `PATCH /api/organizations/{organizationID}/verification`
- `DELETE /api/organizations/{organizationID}`
- `POST /api/organizations/{organizationID}/restore`
- `PUT /api/organizations/{organizationID}/categories`
- `DELETE /api/organizations/{organizationID}/categories`
- `GET /api/organizations/{organizationID}/members`
- `POST /api/organizations/{organizationID}/members`
- `DELETE /api/organizations/{organizationID}/members/{userID}`

### Médias et uploads

- `POST /api/media/upload`
- `DELETE /api/media/{mediaID}`
- `POST /api/organizations/{organizationID}/logo`
- `POST /api/events/{eventID}/image`
- `POST /api/events/images`
- `GET /uploads/*`

### Géocodage

- `GET /api/geocoding/suggestions`

### Administration et staff

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{userID}`
- `DELETE /api/admin/users/{userID}`
- `POST /api/admin/users/{userID}/reset-password`
- `GET /api/staff/accounts`
- `GET /api/staff/users`
- `GET /api/staff/organizations`
- `GET /api/staff/organizers`
- `GET /api/staff/events`
- `GET /api/staff/notification-types`
- `GET /api/staff/notifications`
- `GET /api/staff/moderation-reports`
- `GET /api/staff/moderation-decisions`
- `POST /api/staff/actions`
- `POST /api/moderation/reports`

Les routes privées demandent un JWT valide. Les routes `/api/admin/*` demandent un utilisateur avec le rôle `admin`. Les routes staff sont destinées aux rôles `admin` et `moderator` selon les permissions métier.

## Sécurité HTTP

Le routeur applique :

- request id ;
- logs d'accès ;
- CORS limité à `FRONTEND_URL` ;
- headers de sécurité ;
- CSRF ;
- JWT avec lookup utilisateur ;
- rate limiting par IP, IP+email et email pour le login ;
- rate limiting sur refresh et écritures admin ;
- restriction de rôle pour les zones admin/staff.

Le câblage principal se trouve dans [`internal/http/router.go`](internal/http/router.go).

## Base de données

Le backend utilise PostgreSQL avec deux connexions logiques :

- `APP_DB_*` pour l'API au runtime ;
- `MIGRATIONS_DB_*` pour les migrations.

Cette séparation limite les droits du rôle applicatif.

Les migrations couvrent notamment l'authentification, les organisations, les événements, les catégories, les favoris, l'historique, les médias, les notifications, les signalements, les décisions de modération, les sources externes et les images scrapées.

## Documentation

La navigation complète est dans [`docs/README.md`](docs/README.md).

Pour aller directement au bon endroit :

- comprendre l'architecture : [`docs/architecture/overview.md`](docs/architecture/overview.md)
- comprendre l'arborescence : [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md)
- voir les détails backend : [`docs/backend.md`](docs/backend.md)
- préparer un déploiement : [`docs/operations/deployment-environments.md`](docs/operations/deployment-environments.md)
- vérifier la sécurité : [`docs/security.md`](docs/security.md)
