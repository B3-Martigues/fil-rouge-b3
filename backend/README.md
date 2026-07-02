# Backend Mappening

Backend du projet Mappening.

Il expose une API HTTP sous `/api/*` et fournit le socle serveur du projet :
authentification, gestion des utilisateurs, securite HTTP et acces PostgreSQL.

## Prerequis

- Go 1.25
- PostgreSQL
- une base applicative
- un role applicatif
- un role de migration separe

## Demarrage local

Chaque membre de l'equipe travaille avec sa propre base PostgreSQL locale. Les
migrations et les scripts de seed sont versionnes, mais `backend/.env.local` et
les donnees PostgreSQL restent locaux et ne doivent pas etre commit.

Depuis la racine du repo, une seule commande prepare la base locale puis lance
l'API :

```powershell
.\start-backend.ps1
```

Si vous ne voulez pas remettre a jour l'admin local au demarrage :

```powershell
.\start-backend.ps1 -SkipSeed
```

Le script cree `backend/.env.local` si besoin, demarre PostgreSQL, attend le
healthcheck Docker, lance les migrations, seed l'admin local puis demarre l'API.

Pour preparer uniquement la base sans lancer l'API :

```powershell
.\backend\scripts\setup-local-db.ps1
```

### Demarrage manuel

Demarrer PostgreSQL local depuis la racine du repo :

```bash
docker compose up -d postgres
```

Copier le modele d'environnement :

```bash
cp .env.example .env.local
```

Renseigner ensuite les variables PostgreSQL et les secrets dans `.env.local`.
Ce fichier reste local et ne doit pas etre commit.

Lancer les migrations :

```bash
go run ./cmd/migrate
```

Creer ou remettre a jour l'admin local de developpement :

```bash
psql "postgres://mappening_migrator:mappening_migrator_password@127.0.0.1:55432/mappening?sslmode=disable" -f ./scripts/seed-local-admin.sql
```

Identifiants locaux :

- email : `admin@mappening.local`
- mot de passe : `AdminPassword123!`

Lancer l'API :

```bash
go run ./cmd/api
```

En developpement, l'API ecoute par defaut sur `127.0.0.1:8080`.

## Emails

Les emails sortants sont geres cote backend. En local, `MAIL_MODE=log` ecrit les
messages dans les logs. Pour envoyer reellement :

```text
MAIL_MODE=smtp
MAIL_FROM=no-reply@votre-domaine.fr
MAIL_FROM_NAME=Mappening
SMTP_HOST=smtp.votre-fournisseur.fr
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
```

Les emails de bienvenue, de reinitialisation de mot de passe et de decisions de
moderation utilisent cette configuration.

## Connexion pgAdmin locale

Connexion administrateur PostgreSQL :

```text
Host: localhost
Port: 55432
Maintenance database: postgres
Username: postgres
Password: postgres
```

Connexion applicative, identique a celle utilisee par l'API :

```text
Host: localhost
Port: 55432
Maintenance database: mappening
Username: mappening_user
Password: mappening_app_password
```

Pour verifier la connexion dans le Query Tool pgAdmin :

```sql
SELECT current_database(), current_user, now();
```

Si la connexion API fonctionne, le lancement de `go run ./cmd/api` affiche :

```text
application database connected
```

## Commandes utiles

```bash
go test -count=1 ./...
go build ./...
go vet ./...
govulncheck ./...
go run ./hash_password.go
```

`hash_password.go` lit le mot de passe sur l'entree standard afin d'eviter de le
laisser dans l'historique shell ou la liste des processus.

## Routes principales

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/login/dev`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{userID}`
- `DELETE /api/admin/users/{userID}`
- `POST /api/admin/users/{userID}/reset-password`
- `GET /api/health/db`

Les routes `/api/admin/*` demandent un utilisateur avec le role `admin`.

## Documentation

La navigation complete est dans [`docs/README.md`](docs/README.md).

Pour aller directement au bon endroit :

- comprendre l'architecture : [`docs/architecture/overview.md`](docs/architecture/overview.md)
- comprendre l'arborescence : [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md)
- voir les details backend : [`docs/backend.md`](docs/backend.md)
- preparer un deploiement : [`docs/operations/deployment-environments.md`](docs/operations/deployment-environments.md)
- verifier la securite : [`docs/security.md`](docs/security.md)
