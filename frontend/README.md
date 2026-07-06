# Frontend - Mappening

> Application React dédiée à la découverte, la consultation, la personnalisation et la gestion d'événements locaux.

## Description

Ce dossier contient le frontend de Mappening. Il regroupe les interfaces publiques, les espaces privés et les tableaux de bord nécessaires aux différents rôles de l'application.

Le frontend permet notamment :

- la consultation d'événements sur une carte interactive ;
- la recherche, le tri et le filtrage des événements ;
- l'authentification utilisateur et organisation ;
- la gestion du profil, des préférences, des favoris, de l'historique et des notifications ;
- l'onboarding des préférences utilisateur ;
- la consultation des organisations liées à un utilisateur ;
- le parcours pour devenir organisateur ou créer une organisation ;
- la création et la gestion d'événements par les organisateurs autorisés ;
- l'upload d'images d'événements et de logos d'organisations ;
- les notifications applicatives et les messages liés aux décisions ;
- la validation et la modération des comptes, organisations, événements et signalements ;
- l'administration de la plateforme.

**Version actuelle :** l'application est branchée sur le backend Go via `/api/*`. Les médias servis par le backend passent par `/uploads/*`. Les données métier sont récupérées depuis l'API et hydratées dans le store frontend ; les anciens dossiers `mocks` ont été retirés.

## Stack technique

| Technologie | Usage |
| --- | --- |
| React 19 | Construction de l'interface |
| TypeScript | Typage du code frontend |
| Vite | Serveur de développement, proxy local et build |
| React Router | Routage, layouts, redirects legacy et routes protégées |
| Zustand | Stores applicatifs et persistance locale |
| React Hook Form | Gestion des formulaires |
| Zod | Validation des schémas |
| React Toastify | Notifications applicatives |
| Leaflet / React-Leaflet | Carte interactive |
| Sass | Styles modulaires, tokens et layouts |
| Lucide React | Icônes |
| ESLint | Analyse statique du code |

## Architecture frontend

Le frontend suit une architecture par domaines fonctionnels, aussi appelée feature-based architecture.

```text
src/
|-- app/       # Router, lazy loading et configuration globale
|-- assets/    # Images, logos et polices
|-- domains/   # Modules métier
|-- shared/    # Éléments réutilisables
|-- styles/    # Point d'entrée des styles globaux
|-- main.tsx   # Point d'entrée React
```

Cette structure limite les dépendances inutiles entre fonctionnalités, facilite le travail en équipe et isole les responsabilités métier.

## Organisation des domaines

| Domaine | Contenu principal |
| --- | --- |
| `auth` | Pages de connexion, inscription, mot de passe oublié/réinitialisation, store d'authentification, API, validations et types |
| `user` | Profil, préférences, onboarding, favoris, historique, notifications, organisations liées, événements organisateur et changement de mot de passe |
| `event` | Accueil, carte, marqueurs, popup, météo, favoris, signalements, hooks, API, types et styles |
| `organization` | Pages organisation, détail, setup, profil, gestion des événements, membres, workflow, API et types |
| `admin` | Tableau de bord d'administration, comptes, événements, statistiques, actions staff et styles |
| `moderator` | Tableau de bord modérateur, comptes, organisations, événements, signalements, décisions et suspensions |
| `notification` | Centre de notifications, badge, inbox, types et templates |
| `shared` | Composants UI, layouts, stores, constantes, API clients, styles, hooks, services et utilitaires |

### Dossier `shared`

Le dossier `shared` contient les briques réutilisées dans toute l'application :

- composants UI : `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `CheckboxGroup`, `StatusBadge` ;
- composants de formulaires : modales, confirmation, motif de décision, adresse autocomplétée et champ image ;
- composants de feedback : `ErrorMessage`, `SuccessMessage`, `EmptyState`, `Loader` ;
- layouts : public, privé, administrateur, modérateur et organisation ;
- composants de structure : headers, météo header, user menu, toolbar, stats panels ;
- constantes de routes et stores partagés ;
- clients API et mapping d'identifiants ;
- hooks et utilitaires, notamment météo, upload média et helpers de compte ;
- styles globaux, tokens, mixins, formulaires, boutons, cartes et layouts.

## Routage

Le router utilise le lazy loading et sépare les zones publiques, privées, administrateur et modérateur.

Routes principales :

- public : `/`, `/login`, `/register`, `/forgot-password`, `/reset-password/:token` ;
- compte : `/account/profile`, `/account/favorites`, `/account/history`, `/account/notifications`, `/account/parameters` ;
- organisations utilisateur : `/account/organizations`, `/account/organizations/new`, `/account/organizations/devenir-organisateur`, `/account/organizations/:organizationId` ;
- événements organisateur : `/account/events` ;
- administration : `/administration`, `/administration/events`, `/administration/profile`, `/administration/parameters` ;
- modération : `/moderation`, `/moderation/events`, `/moderation/organizations`, `/moderation/accounts`, `/moderation/reports`, `/moderation/profile`, `/moderation/parameters`.

Des redirects legacy conservent la compatibilité avec les anciennes routes `/profile`, `/favorites`, `/admin`, `/moderator`, `/organizations`, etc.

Certains formulaires peuvent s'ouvrir en modale au-dessus de la page courante, notamment mot de passe oublié, réinitialisation, changement de mot de passe, paramètres et création/devenir organisateur.

## Gestion des rôles

L'application gère actuellement plusieurs rôles :

| Rôle | Accès |
| --- | --- |
| `user` | Profil, préférences, favoris, historique, notifications, organisations liées, événements organisateur et consultation publique |
| `organization` | Compte organisation soumis à validation, redirigé vers les écrans de compte/profil selon le workflow actuel |
| `admin` | Gestion des comptes, organisations, événements, validations, actions staff et profil admin |
| `moderator` | Modération des comptes, organisations, événements, signalements, décisions et suspensions |

Les accès sont protégés via :

- des routes privées ;
- des guards de rôles ;
- des conditions métier liées à l'état des comptes ;
- des redirections selon le rôle et les préférences utilisateur ;
- l'obligation d'onboarding pour certains utilisateurs sans préférences ni organisation.

Règles métier actuelles :

- un utilisateur sans préférences et sans organisation est redirigé vers l'onboarding ;
- un utilisateur peut devenir organisateur ou créer une organisation ;
- l'accès aux pages organisations/événements utilisateur dépend d'une appartenance organisateur ;
- une organisation en attente reste limitée tant qu'elle n'est pas validée ;
- un événement créé ou modifié par une organisation repasse en attente de validation ;
- seuls les événements validés sont affichés dans le listing public ;
- l'administration et la modération affichent les statistiques et les éléments en attente ;
- les comptes, organisations ou événements suspendus peuvent afficher un motif.

## Authentification

Le frontend utilise :

- Zustand pour l'état global d'authentification ;
- la persistance locale pour conserver la session côté navigateur ;
- React Hook Form et Zod pour la validation des formulaires ;
- des routes protégées pour limiter l'accès aux espaces privés ;
- le client HTTP partagé pour communiquer avec l'API backend.

Les parcours disponibles incluent :

- connexion ;
- déconnexion ;
- création de compte utilisateur ;
- création de compte organisation ;
- mot de passe oublié ;
- réinitialisation du mot de passe ;
- changement de mot de passe depuis le profil ;
- désactivation ou suppression de compte selon les endpoints disponibles.

## Intégration API

Les services frontend consomment le backend via `src/shared/api` et les dossiers `api` des domaines métier.

Intégrations principales :

- auth et profil ;
- événements, catégories, favoris et historique ;
- organisations, catégories, membres et workflow organisateur ;
- utilisateurs/admin ;
- staff/modération ;
- notifications ;
- médias et upload d'images ;
- géocodage ;
- météo via les services partagés.

En développement, Vite proxifie :

- `/api` vers `http://127.0.0.1:8080` ;
- `/uploads` vers `http://127.0.0.1:8080`.

Laisser `VITE_API_BASE_URL` vide dans `.env.local` pour utiliser ce proxy, ou renseigner une origine API complète en déploiement.

## Lancement du projet

Depuis le dossier `frontend` :

```powershell
npm install
npm run dev
```

Commandes utiles :

| Commande | Description |
| --- | --- |
| `npm run dev` | Lance le serveur de développement Vite |
| `npm run build` | Compile TypeScript et génère le build de production |
| `npm run lint` | Lance ESLint |
| `npm run preview` | Prévisualise le build de production |

## Fonctionnalités implémentées

### Carte interactive des événements

L'application affiche une carte interactive basée sur Leaflet et React-Leaflet.

Fonctionnalités disponibles :

- affichage dynamique des événements sur la carte ;
- pins personnalisés avec image d'événement ;
- géolocalisation utilisateur ;
- recentrage automatique de la carte ;
- popup détaillée pour chaque événement ;
- filtrage des événements passés.

### Recherche, filtres et tri

La page d'accueil événementielle permet :

- la recherche par titre, description, adresse, ville ou code postal ;
- le filtrage par catégorie et par ville ;
- le tri par date, titre ou ville ;
- l'affichage synchronisé entre la liste et la carte.

### Gestion des favoris

Les utilisateurs connectés peuvent :

- ajouter un événement aux favoris ;
- retirer un événement des favoris ;
- consulter une page dédiée aux événements favoris.

Les favoris sont synchronisés via les endpoints backend et ne sont plus sauvegardés uniquement dans le localStorage.

### Historique, préférences et recommandations

Les utilisateurs disposent :

- d'un historique de consultation ;
- d'un parcours d'onboarding ;
- d'une page de gestion des préférences ;
- de recommandations basées sur les catégories choisies.

### Organisations et organisateurs

Les utilisateurs peuvent :

- devenir organisateur ;
- créer une organisation ;
- consulter leurs organisations ;
- compléter ou modifier un profil organisation ;
- rattacher des catégories ;
- gérer les événements des organisations auxquelles ils ont accès ;
- suivre l'état de validation des organisations et événements.

### Images et médias

Le frontend intègre les endpoints médias pour :

- téléverser une image ;
- remplacer le logo d'une organisation ;
- remplacer l'image d'un événement ;
- afficher les médias servis par `/uploads`.

### Administration et modération

Les espaces administrateur et modérateur permettent :

- la consultation de statistiques ;
- la gestion des comptes ;
- la validation ou le refus des organisations ;
- la validation, le refus, le masquage ou la suppression des événements ;
- le suivi des signalements ;
- la suspension temporaire de comptes, organisations ou événements ;
- l'affichage des motifs de décision ;
- la consultation du journal de décisions.

### Notifications

Le frontend affiche les notifications fournies par l'API et les hydrate dans le store applicatif.

Fonctionnalités disponibles :

- centre de notifications utilisateur ;
- badge de notifications ;
- notifications liées aux changements administratifs ;
- notifications pour les validations, refus, suppressions et suspensions ;
- notifications de sécurité pour les mots de passe ;
- templates email pour les messages de notification.

### Intégration météo

L'application récupère les données météo via les services partagés.

Informations affichées :

- température ;
- vent ;
- conditions météo ;
- icônes météo dynamiques.

La météo est affichée uniquement lorsque les données nécessaires sont disponibles pour l'événement.

## Convention Git

Chaque nouvelle fonctionnalité doit être développée dans une branche dédiée.

Exemples :

- `feature/auth`
- `feature/events`
- `feature/organization-dashboard`
- `feature/moderation`

## Objectif de l'architecture

Cette architecture a été pensée pour :

- faciliter le travail en équipe ;
- limiter les conflits Git ;
- améliorer la maintenabilité ;
- simplifier la scalabilité du frontend ;
- isoler les responsabilités métier ;
- accompagner l'intégration continue avec le backend.
