# Frontend - Plateforme d'événements géolocalisés

> Application React dédiée à la découverte, la consultation, la personnalisation et la gestion d'événements locaux.

## Description

Ce dossier contient le frontend de la plateforme d'événements géolocalisés. Il regroupe les interfaces publiques, les espaces privés et les tableaux de bord nécessaires aux différents rôles de l'application.

Le frontend permet notamment :

- La consultation d'événements sur une carte interactive
- La recherche, le tri et le filtrage des événements
- L'authentification utilisateur
- La gestion du profil, des préférences, des favoris et de l'historique
- La consultation des organisations
- La création et la gestion d'événements par les organisations validées
- Les notifications applicatives et les messages liés aux décisions
- La validation et la modération des comptes, événements et signalements
- L'administration de la plateforme

**Version actuelle :** l'application est branchée sur le backend Go via `/api/*`.
Les données métier sont récupérées depuis l'API et hydratées dans le store frontend.
Les anciens dossiers `mocks` ont été retirés.

## Stack technique

| Technologie | Usage |
| --- | --- |
| React | Construction de l'interface |
| TypeScript | Typage du code frontend |
| Vite | Serveur de développement et build |
| React Router | Routage, layouts et routes protégées |
| Zustand | Stores applicatifs et persistance locale |
| React Hook Form | Gestion des formulaires |
| Zod | Validation des schémas |
| React Toastify | Notifications applicatives |
| Leaflet / React-Leaflet | Carte interactive |
| Sass | Styles modulaires |
| Lucide React | Icônes |
| ESLint | Analyse statique du code |

## Architecture Frontend

Le frontend suit une architecture par domaines fonctionnels, aussi appelée feature-based architecture.

```text
src/
|-- app/       # Configuration globale et Router
|-- domains/   # Modules métier
|-- shared/    # Éléments réutilisables
|-- styles/    # Point d'entrée des styles globaux
|-- main.tsx   # Point d'entrée React
```

Cette structure limite les dépendances inutiles entre fonctionnalités, facilite le travail en équipe et prépare l'intégration progressive des futures API.

## Organisation des domaines

Chaque domaine contient sa propre logique métier afin de garder une architecture modulaire et maintenable.

| Domaine | Contenu principal |
| --- | --- |
| `auth` | Pages de connexion et d'inscription, formulaires, store d'authentification, validations et types |
| `user` | Profil, préférences, onboarding, favoris, historique, changement de mot de passe, hooks et validations |
| `event` | Accueil, carte, marqueurs, popup, météo, favoris, signalements, hooks, types et styles |
| `organization` | Pages organisation, profil, dashboard, gestion des événements, composants, hooks et types |
| `admin` | Tableau de bord d'administration, validations, statistiques, composants et styles |
| `moderator` | Tableau de bord modérateur, comptes, organisations, événements, signalements et suspensions |
| `notification` | Centre de notifications, types et modèles de messages |
| `shared` | Composants UI, layouts, stores, constantes, styles, hooks, services et utilitaires |

### Dossier `shared`

Le dossier `shared` contient les briques réutilisées dans toute l'application :

- Composants UI : `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `StatusBadge`
- Composants de feedback : `ErrorMessage`, `SuccessMessage`, `EmptyState`
- Layouts : public, privé, administrateur, modérateur et organisation
- Composants de structure : headers, pages, cards, toolbars, panels
- Constantes de routes et stores partagés
- Hooks et utilitaires, notamment la météo et les helpers de compte
- Styles globaux, tokens, mixins, formulaires, cartes et layouts

## Gestion des rôles

L'application gère actuellement plusieurs rôles :

| Rôle | Accès |
| --- | --- |
| `user` | Profil, préférences, favoris, historique, organisations et consultation publique |
| `organization` | Accueil organisation, profil, création et gestion des événements selon validation |
| `admin` | Gestion des comptes, organisations, événements et validations |
| `moderator` | Modération des comptes, organisations, événements, signalements et suspensions |

Les accès sont protégés via :

- Des routes privées
- Des guards de rôles
- Des conditions métier liées à l'état des comptes
- Des redirections selon le rôle et les préférences utilisateur

Règles métier actuelles :

- Un compte organisation en attente conserve uniquement l'accès à l'accueil et au profil.
- Un compte organisation validé accède à la création et à la gestion de ses événements.
- Un événement créé ou modifié par une organisation repasse en attente de validation.
- La date de création d'un événement est conservée lors des modifications.
- Seuls les événements validés sont affichés dans le listing public.
- L'administration et la modération affichent les statistiques et les éléments en attente.
- Les comptes ou événements suspendus peuvent afficher un motif.

## Authentification

Le frontend utilise actuellement :

- Zustand pour l'état global d'authentification
- La persistance locale pour conserver la session côté navigateur
- React Hook Form et Zod pour la validation des formulaires
- Des routes protégées pour limiter l'accès aux espaces privés

Les parcours disponibles incluent :

- Connexion
- Déconnexion
- Création de compte utilisateur
- Création de compte organisation
- Mot de passe oublié
- Réinitialisation du mot de passe
- Changement de mot de passe depuis le profil

## Lancement du projet

Depuis le dossier `frontend` :

```bash
npm install
npm run dev
```

En développement, Vite proxifie `/api` vers `http://127.0.0.1:8080`.
Laisser `VITE_API_BASE_URL` vide dans `.env.local` pour utiliser ce proxy, ou
renseigner une origine API complète en déploiement.

Commandes utiles :

| Commande | Description |
| --- | --- |
| `npm run dev` | Lance le serveur de développement Vite |
| `npm run build` | Compile TypeScript et génère le build de production |
| `npm run lint` | Lance ESLint |
| `npm run preview` | Prévisualise le build de production |

## Convention Git

Chaque nouvelle fonctionnalité doit être développée dans une branche dédiée.

Exemples :

- `feature/auth`
- `feature/events`
- `feature/organization-dashboard`
- `feature/moderation`

## Objectif de l'architecture

Cette architecture a été pensée pour :

- Faciliter le travail en équipe
- Limiter les conflits Git
- Améliorer la maintenabilité
- Simplifier la scalabilité du frontend
- Isoler les responsabilités métier
- Préparer l'intégration future avec le backend

## Fonctionnalités implémentées

### Carte interactive des événements

L'application affiche une carte interactive basée sur Leaflet et React-Leaflet.

Fonctionnalités disponibles :

- Affichage dynamique des événements sur la carte
- Pins personnalisés avec image d'événement
- Géolocalisation utilisateur
- Recentrage automatique de la carte
- Popup détaillée pour chaque événement
- Filtrage des événements passés

### Recherche, filtres et tri

La page d'accueil événementielle permet :

- La recherche par titre, description, adresse, ville ou code postal
- Le filtrage par catégorie et par ville
- Le tri par date, titre ou ville
- L'affichage synchronisé entre la liste et la carte

### Gestion des favoris

Les utilisateurs connectés peuvent :

- Ajouter un événement aux favoris
- Retirer un événement des favoris
- Consulter une page dédiée aux événements favoris

Les favoris sont désormais synchronisés via les endpoints backend et ne sont plus sauvegardés dans le localStorage.

### Historique et préférences

Les utilisateurs disposent :

- D'un historique de consultation
- D'un parcours d'onboarding
- D'une page de gestion des préférences
- De recommandations basées sur les catégories choisies

### Organisations

Les organisations peuvent :

- Créer un compte organisation
- Attendre une validation administrateur
- Compléter leur profil
- Créer et modifier leurs événements après validation
- Suivre l'état de validation de leurs événements

### Administration et modération

Les espaces administrateur et modérateur permettent :

- La consultation de statistiques
- La validation des organisations
- La validation des événements
- Le suivi des signalements
- La suspension temporaire de comptes ou d'événements
- L'affichage des motifs de décision

### Notifications

Le frontend affiche les notifications fournies par l'API et les hydrate dans le store applicatif.

Fonctionnalités disponibles :

- Centre de notifications utilisateur
- Notifications liées aux changements administratifs
- Notifications pour les validations, refus, suppressions et suspensions
- Notifications de sécurité pour les mots de passe
- Templates email pour les messages de notification

### Modération

Le domaine `moderator` regroupe les workflows de contrôle des contenus et des comptes.

Fonctionnalités disponibles :

- Validation ou refus motivé des organisations en attente
- Validation, refus, masquage et suppression des événements
- Suspension temporaire de comptes utilisateurs ou organisations
- Traitement des signalements par priorité
- Journalisation des décisions avec motif obligatoire

### Intégration météo Open-Meteo

L'application récupère les données météo via l'API Open-Meteo.

Informations affichées :

- Température
- Vent
- Conditions météo
- Icônes météo dynamiques

La météo est affichée uniquement pour les événements à venir dans les 7 prochains jours.
