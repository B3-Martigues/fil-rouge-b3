# Mappening - Plateforme d'événements géolocalisés

> Application web de découverte, consultation, recommandation et gestion d'événements locaux, pensée pour les utilisateurs, les organisateurs, les organisations, les modérateurs et les administrateurs.

## Description du projet

Mappening centralise des événements locaux pour les afficher sur une carte interactive et dans un listing filtrable. L'objectif est de faciliter l'accès à l'information locale, souvent dispersée sur plusieurs plateformes, tout en proposant des parcours adaptés aux différents rôles de l'application.

**État actuel :** le frontend React est connecté au backend Go via `/api/*` et consomme les données métier depuis PostgreSQL. Le backend expose une API REST, utilise Redis pour le cache des événements, sert les médias uploadés, envoie ou journalise les emails applicatifs, et lance un scraping planifié de sources externes lorsque la configuration l'autorise.

Depuis la dernière rédaction du README, les ajouts principaux sont :

- Remplacement des mocks événements par les données réelles de l'API et de PostgreSQL.
- Backend organisations complet : création, profil, catégories, membres, statuts, validation et restauration.
- Backend événements complet : listes publiques, détail, catégories, favoris, historique, activation et gestion par organisation.
- Module staff/modération : tableaux de bord, signalements, décisions motivées, suspensions, notifications et actions d'administration.
- Scraping fonctionnel de Tarpin Bien, avec commande dédiée, scheduler backend, sources externes, images et synchronisation des événements.
- Cache Redis branché sur le repository événements pour accélérer les lectures et invalider le cache lors des créations/modifications.
- Upload et gestion des médias pour les images d'événements et logos d'organisations.
- Autocomplétion d'adresse via endpoint de géocodage.
- Durcissement sécurité : CSRF, headers HTTP, rate limiting, logs de requêtes, refresh tokens persistés et validation stricte de configuration.

La documentation détaillée du frontend est disponible dans [`frontend/README.md`](frontend/README.md). La documentation backend est disponible dans [`backend/README.md`](backend/README.md).

## Installation locale en équipe

Chaque membre de l'équipe utilise sa propre base PostgreSQL locale. Le projet partage le `docker-compose.yml`, les migrations SQL, les scripts de seed et les valeurs de développement, mais `backend/.env.local`, `frontend/.env.local` et les données de base restent propres à chaque machine.

### Prérequis

- Docker Desktop
- Go 1.25
- Node.js et npm pour le frontend
- pgAdmin, optionnel, pour inspecter la base avec une interface graphique

### Démarrage rapide de la base

Depuis la racine du projet :

```powershell
.\backend\scripts\setup-local-db.ps1
```

Ce script :

1. crée `backend/.env.local` depuis `backend/.env.example` s'il n'existe pas ;
2. démarre le conteneur PostgreSQL local ;
3. attend que PostgreSQL soit prêt ;
4. lance les migrations backend ;
5. crée ou remet à jour les données locales de développement, dont l'admin local et des événements de seed.

Identifiants admin locaux :

```text
Email: admin@mappening.local
Mot de passe: AdminPassword123!
```

### Redis local

Le backend initialise désormais Redis au démarrage. Si Redis n'est pas déjà lancé, démarrez-le depuis la racine :

```powershell
docker compose up -d redis
```

Le `docker-compose.yml` expose Redis sur `localhost:6379` avec persistance AOF dans le volume `redis_data`.

### Lancer le backend

Depuis la racine du projet :

```powershell
.\start-backend.ps1
```

Si vous ne voulez pas remettre à jour les données de seed au démarrage :

```powershell
.\start-backend.ps1 -SkipSeed
```

Commande manuelle équivalente :

```powershell
cd backend
go run ./cmd/api
```

Si la configuration est correcte, le backend affiche notamment `application database connected`, `redis connected` et, si activé, `tarpin bien scraper scheduler started`.

### Lancer le frontend

Depuis le dossier `frontend` :

```powershell
npm install
npm run dev
```

En développement, Vite proxifie `/api` et `/uploads` vers `http://127.0.0.1:8080`. Laisser `VITE_API_BASE_URL` vide dans `frontend/.env.local` pour utiliser ce proxy, ou renseigner une origine API complète en déploiement.

### Connexion pgAdmin

Connexion administrateur PostgreSQL :

```text
Host: localhost
Port: 55432
Maintenance database: postgres
Username: postgres
Password: postgres
```

Connexion applicative, identique à celle du backend :

```text
Host: localhost
Port: 55432
Maintenance database: mappening
Username: mappening_user
Password: mappening_app_password
```

Dans pgAdmin, ouvrir le Query Tool sur la base `mappening` et tester :

```sql
SELECT current_database(), current_user, now();
```

### Réinitialiser sa base locale

Si votre base locale est dans un mauvais état, vous pouvez supprimer le volume Docker puis relancer le setup :

```powershell
docker compose down -v
.\backend\scripts\setup-local-db.ps1
```

Attention : cette commande supprime les données PostgreSQL et Redis locales de votre machine. Elle n'impacte pas les bases locales des autres membres de l'équipe.

## Objectifs

- Centraliser les événements locaux.
- Faciliter leur découverte grâce à une carte interactive et un listing filtrable.
- Proposer une expérience personnalisée selon les préférences utilisateur.
- Améliorer l'accessibilité des informations liées aux événements.
- Permettre aux utilisateurs de devenir organisateurs et de gérer des organisations.
- Encadrer la publication avec une validation administrateur ou modérateur.
- Automatiser l'import d'événements externes tout en gardant une donnée exploitable par l'application.
- Maintenir une architecture full-stack testable, sécurisée et extensible.

## Public cible

- Habitants de la région
- Étudiants
- Touristes
- Jeunes actifs
- Associations et organisateurs d'événements
- Organisations locales
- Administrateurs et modérateurs de la plateforme

## Fonctionnalités principales

- Découverte d'événements locaux sur carte interactive Leaflet.
- Recherche, filtrage, tri, géolocalisation utilisateur et affichage synchronisé carte/liste.
- Consultation du détail d'un événement avec image, catégories, adresse, prix, billetterie et météo.
- Création de compte utilisateur ou organisation, connexion, déconnexion, refresh token, mot de passe oublié et réinitialisation.
- Profil utilisateur, changement de mot de passe, désactivation/suppression de compte, préférences, onboarding, favoris et historique.
- Recommandations personnalisées selon les catégories préférées.
- Parcours organisateur : devenir organisateur, créer une organisation, gérer son profil, ses membres, ses catégories et ses événements.
- Validation des organisations et des événements avant publication publique.
- Upload d'images d'événements et de logos d'organisations.
- Notifications in-app et emails applicatifs pour les actions de sécurité, validation, refus, suppression et suspension.
- Signalement d'événements, d'organisations ou de comptes.
- Tableaux de bord administrateur et modérateur avec actions staff, décisions motivées et suivi des signalements.
- Scraping Tarpin Bien avec sources externes, synchronisation, images récupérées et commande de job dédiée.
- Cache Redis des événements pour améliorer les performances API.

## Choix techniques

### Frontend

- React 19, TypeScript et Vite.
- Architecture par domaines fonctionnels.
- React Router pour le routage, les layouts et les routes protégées.
- Leaflet et React-Leaflet pour la carte interactive.
- React Hook Form et Zod pour les formulaires typés et validés.
- Zustand pour l'état applicatif.
- Sass pour les styles, tokens, layouts et composants.
- Lucide React pour les icônes.
- React Toastify pour les notifications côté interface.

### Backend

- Go 1.25 pour l'API REST.
- `chi` pour le routage HTTP et les middlewares.
- Architecture par modules métier avec handler, service/repository et modèles.
- PostgreSQL avec migrations SQL versionnées.
- Redis via `go-redis` pour le cache.
- Zerolog pour les logs structurés.
- JWT, refresh tokens, cookies et protection CSRF pour l'authentification.
- Mailer backend en modes `disabled`, `log` ou `smtp`.

### Données et intégrations

- PostgreSQL pour les comptes, profils, organisations, événements, catégories, favoris, historique, notifications, signalements et décisions.
- Redis pour le cache des événements.
- Stockage local `uploads/` pour les médias servis par le backend.
- Géocodage serveur pour la normalisation et les suggestions d'adresses.
- Scraper Tarpin Bien pour alimenter automatiquement les événements externes.
- Météo côté frontend via les services partagés.

## Architecture

L'application suit une architecture en couches :

```text
Frontend -> API REST -> Middlewares -> Handlers -> Services/Repositories -> PostgreSQL/Redis
```

Le projet est séparé en plusieurs espaces :

| Espace | Rôle |
| --- | --- |
| `frontend` | Application web React, routes, interfaces, stores et intégration API |
| `backend` | API REST Go, migrations, jobs, scraping, sécurité, médias et persistance |
| `docs` | Documents projet, architecture, cahier des charges, audits et supports de suivi |
| `tests` | Espace prévu pour les tests complémentaires |

Modules backend principaux :

- `auth` : inscription, connexion, session, profil, mots de passe, préférences et notifications utilisateur.
- `users` : gestion admin des comptes.
- `organizations` : organisations, catégories, membres, statuts et validation.
- `events` : événements, catégories, favoris, historique et cache.
- `staff` : dashboards staff, modération, signalements, décisions et notifications.
- `media` : upload, suppression et rattachement des médias.
- `geocoding` : suggestions et normalisation d'adresses.
- `scraping` : import Tarpin Bien et récupération d'images.
- `cache`, `mailer`, `http/middleware`, `db`, `config` : socle technique.

## Gestion des rôles

L'application distingue plusieurs rôles :

| Rôle | Accès principal |
| --- | --- |
| `user` | Consultation, profil, préférences, favoris, historique, organisations liées et signalements |
| `organization` | Compte organisation soumis à validation, profil organisation et gestion d'événements selon statut |
| `admin` | Gestion complète des comptes, organisations, événements, validations et actions staff |
| `moderator` | Modération des comptes, organisations, événements, signalements et suspensions selon permissions |

Règles métier importantes :

- Un utilisateur peut suivre un onboarding de préférences avant d'accéder à certaines pages privées.
- Un utilisateur peut devenir organisateur ou créer une organisation.
- Une organisation en attente reste limitée tant qu'elle n'est pas validée.
- Une organisation validée peut créer et gérer ses événements.
- Les événements créés ou modifiés doivent passer par une validation avant publication publique.
- Les signalements sont traités par les rôles staff avec motif obligatoire.
- Les comptes, organisations et événements peuvent être suspendus, masqués, supprimés ou restaurés selon les règles du module staff.

## Sécurité

- Authentification JWT côté backend.
- Refresh tokens persistés et endpoints de renouvellement/déconnexion.
- Cookies sécurisables selon l'environnement.
- Protection CSRF avec header `X-CSRF-Token`.
- CORS limité à `FRONTEND_URL`.
- Guards de rôles côté frontend et middlewares de rôle côté backend.
- Validation des données côté frontend et backend.
- Rate limiting sur login, refresh et écritures admin.
- Headers de sécurité HTTP : CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-*`, HSTS selon proxy HTTPS.
- Logs de requêtes avec request id.
- Validation stricte des variables de configuration hors environnement local.
- Gestion des comptes désactivés, supprimés ou suspendus.

## Commandes utiles

### Backend

Depuis `backend` :

```powershell
go run ./cmd/migrate
go run ./cmd/api
go run ./cmd/scrape-tarpin-bien
go test ./...
go build ./...
go vet ./...
```

### Frontend

Depuis `frontend` :

```powershell
npm run dev
npm run build
npm run lint
npm run preview
```

### Docker

Depuis la racine :

```powershell
docker compose up -d postgres redis
docker compose down
docker compose down -v
```

## Documentation

- Frontend : [`frontend/README.md`](frontend/README.md)
- Backend : [`backend/README.md`](backend/README.md)
- Navigation backend : [`backend/docs/README.md`](backend/docs/README.md)
- Architecture backend : [`backend/docs/architecture/overview.md`](backend/docs/architecture/overview.md)
- Structure projet backend : [`backend/docs/architecture/project-structure.md`](backend/docs/architecture/project-structure.md)
- Sécurité backend : [`backend/docs/security.md`](backend/docs/security.md)
- Contrats attendus : [`docs/backend-contracts.md`](docs/backend-contracts.md)
- Cahier des charges : [`docs/cahier-des-charges.pdf`](docs/cahier-des-charges.pdf)

## Planning

Le projet suit une progression full-stack :

1. Conception, cadrage et maquettage.
2. Développement frontend et parcours principaux.
3. Authentification, sécurité et premiers contrats backend.
4. Persistance PostgreSQL, migrations et remplacement des mocks.
5. Modules métier : événements, organisations, staff/modération, médias et notifications.
6. Scraping, cache Redis, durcissement sécurité et tests.
7. Déploiement, vérifications post-déploiement et stabilisation.

## Équipe

Projet réalisé dans le cadre du titre RNCP Concepteur Développeur d'Applications (CDA).

Ce projet est développé en groupe de 3 personnes, avec une répartition des tâches frontend, backend et gestion de projet, ainsi qu'une organisation basée sur Git et un board de suivi.
