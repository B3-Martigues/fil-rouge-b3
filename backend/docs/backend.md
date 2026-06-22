# Backend

Ce document decrit le backend Go de Mappening.

Pour le demarrage rapide, consulter [`../README.md`](../README.md).

## Role

Le backend gere :

- l'authentification
- les refresh tokens
- les comptes utilisateurs
- les routes d'administration
- les middlewares de securite
- la connexion PostgreSQL
- les migrations SQL

## Configuration

Le fichier de reference est [`../.env.example`](../.env.example).

En local, copier ce fichier vers `.env.local`. Seul `.env.local` est charge
automatiquement, et uniquement pour les environnements de developpement :
`dev`, `development`, `local` ou `test`.

Hors developpement, les variables doivent etre injectees par la plateforme de
deploiement.

Variables importantes :

- `ENV`
- `ADDR`
- `FRONTEND_URL`
- `CSRF_COOKIE_DOMAIN`
- `JWT_SECRET`
- `COOKIE_SECURE`
- `APP_DB_*`
- `MIGRATIONS_DB_*`
- `TRUSTED_PROXY_CIDRS`

## Commandes

Depuis `backend/` :

```bash
go run ./cmd/migrate
go run ./cmd/api
```

Checks locaux recommandes :

```bash
go test -count=1 ./...
go build ./...
go vet ./...
govulncheck ./...
```

Generer un hash bcrypt sans exposer le mot de passe dans l'historique shell :

```bash
go run ./hash_password.go
```

Le programme affiche un prompt masque quand il est lance dans un terminal. Il
accepte aussi l'entree standard pour les usages automatises.

## Routes

### Sante

- `GET /api/health`
- `GET /api/health/db`

`/api/health/db` demande un utilisateur admin.

### Authentification

- `POST /api/auth/login`
- `POST /api/auth/login/dev`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Administration utilisateurs

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{userID}`
- `DELETE /api/admin/users/{userID}`
- `POST /api/admin/users/{userID}/reset-password`

Les routes admin demandent le role `admin`.

## Securite HTTP

Le routeur applique :

- request id
- logs d'acces
- CORS
- headers de securite
- CSRF
- JWT
- rate limiting par IP, par IP+email et par email pour le login
- restriction de role pour l'administration

Le cablage principal se trouve dans [`../internal/http/router.go`](../internal/http/router.go).

## Base de donnees

Le backend utilise PostgreSQL avec deux connexions logiques :

- `APP_DB_*` pour l'API au runtime
- `MIGRATIONS_DB_*` pour les migrations

Cette separation limite les droits du role applicatif.

Les changements qui peuvent supprimer l'acces admin actif passent par des
transactions seriealisables avec verrous PostgreSQL. Cela evite qu'une course
entre deux requetes supprime ou desactive le dernier administrateur actif.
