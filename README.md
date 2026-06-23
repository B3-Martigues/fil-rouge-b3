# Plateforme d'événements géolocalisés

> Application web de découverte, consultation et gestion d'événements locaux, pensée pour les utilisateurs, les organisations, les modérateurs et les administrateurs.

## Description du projet

Ce projet consiste à développer une application web permettant aux utilisateurs de découvrir des événements autour d'eux de manière simple, rapide et personnalisée.

L'application centralise des événements locaux, les affiche sur une carte interactive et les présente dans une interface de consultation filtrable. L'objectif est de faciliter l'accès à l'information locale, souvent dispersée sur plusieurs plateformes, tout en proposant des espaces dédiés aux utilisateurs, aux organisations, aux modérateurs et aux administrateurs.

**État actuel :** le frontend fonctionne avec des données mockées et une persistance locale. Le backend REST, la base de données et les intégrations serveur restent prévus pour la suite du projet.

La documentation détaillée du frontend est disponible dans [`frontend/README.md`](frontend/README.md).

## Installation locale en equipe

Chaque membre de l'equipe utilise sa propre base PostgreSQL locale. Le projet
partage le `docker-compose.yml`, les migrations SQL, les scripts de seed et les
valeurs de developpement, mais le fichier `backend/.env.local` et les donnees de
la base restent propres a chaque machine.

### Prerequis

- Docker Desktop
- Go 1.25
- Node.js pour le frontend
- pgAdmin pour inspecter la base avec une interface graphique

### Demarrage rapide de la base

Depuis la racine du projet :

```powershell
.\backend\scripts\setup-local-db.ps1
```

Ce script :

1. cree `backend/.env.local` depuis `backend/.env.example` s'il n'existe pas ;
2. demarre le conteneur PostgreSQL local ;
3. attend que PostgreSQL soit pret ;
4. lance les migrations backend ;
5. cree ou remet a jour l'admin local de developpement.

Identifiants admin locaux :

```text
Email: admin@mappening.local
Mot de passe: AdminPassword123!
```

### Connexion pgAdmin

Connexion administrateur PostgreSQL :

```text
Host: localhost
Port: 55432
Maintenance database: postgres
Username: postgres
Password: postgres
```

Connexion applicative, identique a celle du backend :

```text
Host: localhost
Port: 55432
Maintenance database: mappening
Username: mappening_user
Password: mappening_app_password
```

Dans pgAdmin, ouvrez le Query Tool sur la base `mappening` et testez :

```sql
SELECT current_database(), current_user, now();
```

### Lancer le backend

Depuis la racine du projet, une seule commande prepare la base locale puis lance
l'API :

```powershell
.\start-backend.ps1
```

Si vous ne voulez pas remettre a jour l'admin local au demarrage :

```powershell
.\start-backend.ps1 -SkipSeed
```

Commande manuelle equivalente :

```powershell
cd backend
go run ./cmd/api
```

Si la connexion est bonne, le backend affiche `application database connected`.

### Reinitialiser sa base locale

Si votre base locale est dans un mauvais etat, vous pouvez supprimer le volume
Docker puis relancer le setup :

```powershell
docker compose down -v
.\backend\scripts\setup-local-db.ps1
```

Attention : cette commande supprime les donnees PostgreSQL locales de votre
machine. Elle n'impacte pas les bases locales des autres membres de l'equipe.

## Objectifs

- Centraliser les événements locaux
- Faciliter leur découverte grâce à une carte interactive et un listing filtrable
- Proposer une expérience personnalisée selon les préférences utilisateur
- Améliorer l'accessibilité des informations liées aux événements
- Permettre aux organisations et organisateurs de proposer des événements
- Encadrer la publication avec une validation administrateur ou modérateur
- Préparer une architecture maintenable pour l'intégration future du backend

## Public cible

- Habitants de la région
- Étudiants
- Touristes
- Jeunes actifs
- Associations et organisateurs d'événements
- Organisations locales
- Administrateurs et modérateurs de la plateforme

## Fonctionnalités principales

- Découverte d'événements locaux sur une carte interactive
- Recherche, filtrage et tri des événements
- Consultation du détail d'un événement avec informations météo
- Création de compte, connexion, récupération et réinitialisation de mot de passe
- Profil utilisateur, préférences, favoris et historique
- Recommandations personnalisées selon les préférences
- Parcours d'inscription et de validation des organisations
- Création et gestion d'événements par les organisations validées
- Validation des événements avant publication publique
- Signalement, modération et suspension temporaire avec motif
- Tableaux de bord administrateur et modérateur

## Choix techniques

### Frontend

- React, TypeScript et Vite
- Architecture par domaines fonctionnels
- Interface cartographique avec Leaflet et React-Leaflet
- Formulaires typés et validés avec React Hook Form et Zod
- État applicatif avec Zustand

Voir la documentation frontend : [`frontend/README.md`](frontend/README.md).

### Backend

- Go pour l'API REST prévue
- Architecture en couches prévue : Controller / Service / Repository

### Bases de données

- PostgreSQL pour les données principales prévues
- Redis pour le cache, les sessions et la performance prévue

## Architecture

L'application suit une architecture classique en plusieurs couches :

```text
Frontend -> API REST -> Middleware -> Controller -> Service -> Repository -> Base de données
```

Le projet est séparé en plusieurs espaces :

| Espace | Rôle |
| --- | --- |
| `frontend` | Application web React, routes, interfaces, états locaux et mocks |
| `backend` | API REST Go prévue pour exposer les données métier |
| `docs` | Documents projet, architecture, cahier des charges et supports de suivi |
| `tests` | Espace prévu pour les tests complémentaires |

Un système de scraping est envisagé afin de récupérer automatiquement des événements depuis des sources externes.

## Gestion des rôles

L'application distingue plusieurs rôles :

### Utilisateur

Compte classique avec accès au profil, aux préférences, aux favoris, à l'historique et à la consultation des organisations.

### Organisation

Compte organisateur soumis à validation administrateur.

- Un compte organisation en attente conserve uniquement l'accès à l'accueil et au profil.
- Un compte organisation validé peut créer, modifier et gérer ses événements.

### Administrateur

Compte disposant d'un accès à la gestion des utilisateurs, des organisations et des événements.

L'administrateur valide les comptes organisation et les événements avant leur publication.

### Modérateur

Compte disposant d'un accès à la validation des événements, au suivi des signalements et aux suspensions temporaires.

## Sécurité

- Authentification JWT prévue côté backend
- Gestion des rôles : utilisateur, administrateur, modérateur, organisation
- Routes privées et guards de rôles côté frontend
- Validation des données côté frontend et côté backend prévu
- Validation administrateur des comptes organisation
- Validation administrateur ou modérateur des événements avant publication
- Gestion des comptes supprimés, désactivés ou suspendus
- Protection contre les abus prévue côté backend avec rate limiting

## Planning

Le projet est organisé en plusieurs étapes :

1. Conception & cadrage
2. Développement frontend
3. Intégration des données mockées et des parcours utilisateurs
4. Développement backend & données
5. Connexion frontend / API REST
6. Déploiement & tests

## Équipe

Projet réalisé dans le cadre du titre RNCP Concepteur Développeur d'Applications (CDA).

Ce projet est développé en groupe de 3 personnes, avec une répartition des tâches frontend, backend et gestion de projet, ainsi qu'une organisation basée sur Git et un board de suivi.
