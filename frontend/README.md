# Frontend - Plateforme d'événements géolocalisés

## Description

Frontend de l'application de gestion et découverte d'événements géolocalisés

L'application permet:

- la consultation d'événements sur une carte
- la recherche et le filtrage des événements par catégorie, ville et code postal
- l'authentification utilisateur
- la gestion des favoris et de l'historique
- la gestion d'événements par les organizations
- la validation des comptes organization par l'administration
- la validation des événements par l'administration avant affichage public
- l'administration de la plateforme

Version actuelle :

Le frontend fonctionne actuellement avec des données mockées (mocks frontend)
Aucune connexion backend réelle n'est encore implémentée.

Les données temporaires sont stockées dans:

- domains/auth/mocks
- domains/events/mocks
- domains/user/mocks

Cette structure permettra de remplacer facilement les mocks par les futures API backend.

## Stack technique

- React
- Type Script
- React Router
- Zustand
- React Hook Form
- Zod
- React Toastify

## Architecture Frontend

Le frontend suit une architecture par domaines (feature-based architecture)

Exemple:

src/
|--app/ # Configuration globale et Router
|--domains/ # Modules métier
|--shared/ # Eléments réutilisables
|--styles/ # Styles globaux
|--main.tsx # Point d'entrée React

## Organisation des domaines

Chaque domaine contient sa propre logique métier afin de garder une architecture modulaire et scalable

auth/
Contient:

- pages # pages liées à l'authentification
- components # formulaires login/register
- hooks # logique d'authentification
- store # store Zustand d'authentification
- validations # schémas de validation des formulaires
- api # futurs appels API auth
- mocks # utilisateurs mockés temporaires
- styles # styles liés à l'authentification
- types # types liés à l'authentification

user/
Contient:

- pages # pages liées à l'utilisateur (profil, historique)
- components # composants spécifiques à l'utilisateur
- hooks # logique métier liée aux utilisateurs
- api # futurs appels API backend pour les utilisateurs
- mocks # données temporaires utilisateur (favoris, historique)
- validations # schèmas de validation des formulaires
- styles # styles liés à l'utilisateur
- types # types liés à l'utilisateur

organization/
Contient:

- pages # pages liées à l'espace organization (dashboard, profil, gestion des événements)
- components # composants spécifiques à l'organization
- hooks # logique métier liée aux organizations (ex. accès, is_active)
- api # futurs appels API backend pour les organizations
- mocks # données temporaires pour les comptes organization
- validations # schèmas de validation des formulaires
- styles # styles liés aux organizations
- types # types liés aux organizations

admin/
Contient:

- pages # pages d'administration (dashboard, gestion utilisateurs, gestion événements, validations)
- components # composants spécifiques à l'administration
- api # futurs appels API backend pour l'administration
- styles # styles liés à l'espace administrateur

events/
Contient:

- pages # pages liées aux événements
- components # composants réutilisables liés aux événements
- hooks # logique métier des événements
- api # futurs appels API backend
- mocks # données temporaires utilisées pendant le développement frontend
- validations # schèmas de validation des formulaires
- styles # styles liés aux événements
- types # types liés aux événements

Le dossier shared contient les éléments réutilisables dans toute l'application
shared/
Contient:

- UI components # Button, Input, FormField
- feedback components # Loader, ErrorMessage, SuccessMessage, EmptyState
- layouts # Public, Privat, Admin, Organization - facilitent la scalabilité du projet
- constants # routes globales, constantes métier
- hooks # hooks réutilisables
- utils # fonctions utilitaires

## Gestion des rôles

L'application gère actuellement plusieurs rôles:

- user # compte utilisateur classique avèc accès immédiat
- organization # compte organization avec accès limité tant que la validation administrateur est en attente
- admin # accès à l'administration de la plateforme

Les accès sont protégés via:

- des routes privées
- des guards de rôles
- des conditions métier (is_active pour les organizations)

Règles métier actuelles:

- un compte organization en attente conserve uniquement les onglets Accueil et Profil
- un compte organization validé accède à la création et à la gestion de ses événements
- une connexion organization redirige vers /organization/events
- un événement créé ou modifié par une organization repasse en attente de validation
- la date de création d'un événement est conservée lors des modifications
- la liste des événements organization reprend l'affichage des cartes de validation admin
- seuls les événements validés sont affichés dans le listing public
- l'administration affiche les statistiques des organizations et événements en attente
- l'administration peut modifier, supprimer ou valider les organizations et événements en attente

## Authentification

Le frontend utilise actuellement:

- Zustand pour le state global
- persist middleware pour le localStorage
- React Hook Form + Zod pour la validation des formulaires

## Lancement du projet

Installation:
npm install (à lancer dans le dossier frontend)

Démarage du frontend:
npm run dev

## Convention Git

Chaque nouvelle fonctionnalité doit être développée dans une branche dédiée
examples:

- feature/auth
- feature/events
- feature/organization-dashboard

## Objectif de l'architecture

Cette architecture a été pensée pour:

- faciliter le travail en équipe
- limiter les conflits Git
- améliorer la maintenabilité
- simplifier la scalabilité du frontend
- préparer l'intégration future avec le backend

## Fonctionalités implémentées

# Carte interactive des événements

L'application affiche une carte interactive basée sur Leaflet et React-Leaflet

Fonctionnalités disponibles:

- affichage dynamique des événements sur la carte
- géolocalisation utilisateur
- recentrage automatique de la carte
- popup détaillé pour chaque événement
- filtrage des événements passés

# Gestion des favoris

Les utilisateurs connectés peuvent:

- ajouter un événement aux favoris
- retirer un événement des favoris
- consulter une page dédiée aux événements favoris

Les favoris sont actuellement sauvegardés dans le localStorage avec une clé unique par utilisateur.

# Intégration météo (Open-Meteo API)

L'application récupère les données météo via l'API OPEN-METEO

Informations affichées:

- température
- vent
- conditions météo
- icônes météo dynamiques

La météo est affichée uniquement pour les événements à venir dans le 7 prochains jours