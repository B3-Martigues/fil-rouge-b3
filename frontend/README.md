# Frontend - Plateforme d'événements géolocalisés

## Description 

Frontend de l'application de gestion et découverte d'événements géolocalisés

L'application permet:
- la consultation d'événements sur une carte
- l'authentification utilisateur
- la gestion des favoris et de l'historique
- la gestion d'événements par les entreprises
- l'administration de la plateforme

Version actuelle  :

Le frontend fonctionne actuellement avec des données mockées (mocks frontend)
Aucun connexion backend réelle n'est encore implémentée.

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

Le frontend suit un architecture par domaines (feature-based architecture)

Example:

src/
|--app/         # Configuration globale et Router 
|--domains/     # Modules métier
|--shared/      # Eléments réutilisables
|--styles/      # Styles globaux
|--main.tsx/    # Point d'entrée React

## Organisation des domains

Chaque domain contient sa propre logique métier afin de garder une architecture modulaire et scalable

auth/
Contient:
- pages         # pages liées à l'authentification
- components    # formulaires login/register
- hooks         # logique d'authentification
- store         # store Zustand d'authentification
- validations   # schèmas de validation des formulaires
- api           # futurs appels API auth
- mocks         # utilisateurs mockés temporaires
- types         # types liés à l'authentification

events/
Contient:
- pages         # pages liées aux événements
- components    # composants réutilisables liés aux événements
- hooks         # logique métier des événements
- api           # futurs appels API backend
- mocks         # données temporaires utilisées pendant le développement frontend
- validations   # schèmas de validation des formulaires
- types         # types liés aux événements

company/
Contient:
- pages         # pages liées à l'espace entreprise (dashboard, profil)
- components    # composants spécifiques à l'entreprise
- hooks         # logique métier liée aux entreprises (ex. accès, is_active)
- api           # futurs appels API backend pour les entreprises
- mocks         # données temporaires pour les comptes entreprise
- validations   # schèmas de validation des formulaires
- types         # types liés aux entreprises

user/
Contient:
- pages         # pages liées à l'utilisateur (profil, historique)
- components    # composants spécifiques à l'utilisateur
- hooks         # logique métier liée aux utilisateur
- api           # futurs appels API backend pour les utilisateurs
- mocks         # données temporaires utilisateur (favoris, historique)
- validations   # schèmas de validation des formulaires
- types         # types liés à l'utilisateur

Le dossier shared contient les éléments réutilisables dans toute l'application:
- UI components         # Button, Input, Formfield
- Feedback components   # Loader, ErrorMessage, SuccessMessage, EmptyState
- Layouts               # Public, Privat, Admin, Company - facilitent la scalabilité du projet
