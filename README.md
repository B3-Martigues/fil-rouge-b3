Plateforme d'événements géolocalisés

Description du projet

Ce projet consiste à développer une application web permettant aux utilisateurs de découvrir des événements autour d'eux de manière simple et rapide.

L'application centralise des événements provenant de différentes sources et les affiche dans une interface de consultation filtrable. L'objectif est de faciliter l'accès à l'information locale, souvent dispersée sur plusieurs plateformes.

Objectifs

Centraliser les événements locaux
Faciliter leur découverte grâce à une carte interactive et un listing filtrable
Proposer une expérience personnalisée
Améliorer l'accessibilité des informations
Permettre aux entreprises et organisateurs de proposer des événements
Garantir une validation administrateur avant publication

Public cible

Habitants de la région
Étudiants
Touristes
Jeunes actifs
Associations et organisateurs d'événements
Entreprises locales

Fonctionnalités principales

Consultation des événements sur une carte interactive
Listing des événements disponibles dans l'application
Recherche d'événements par titre, description, adresse, ville ou code postal
Filtrage des événements par catégorie et par ville
Tri des événements par date, titre ou ville
Détail d'un événement (date, lieu, description, météo)
Création de compte utilisateur
Gestion des favoris et historique
Recommandations personnalisées
Notifications (PWA)
Inscription des comptes entreprise avec validation administrateur
Ajout et gestion d'événements par les entreprises validées
Validation des événements par un administrateur avant affichage public
Conservation de la date de création des événements lors des modifications
Administration des comptes utilisateurs, entreprises et événements
Statistiques administrateur sur les comptes et événements en attente

Choix techniques

Frontend
React
TypeScript
React Router
Zustand
React Hook Form
Zod
Leaflet (carte interactive)

Backend
Go (API REST)
Architecture en couches (Controller / Service / Repository)

Bases de données
PostgreSQL (données principales)
Redis (cache, sessions, performance)

Architecture

L'application suit une architecture classique en plusieurs couches :

Frontend -> API REST -> Middleware -> Controller -> Service -> Repository -> Base de données

Le frontend est organisé par domaines fonctionnels afin de séparer les responsabilités liées à l'authentification, aux utilisateurs, aux entreprises, aux événements et à l'administration.

Un système de scraping permet également de récupérer automatiquement des événements depuis des sources externes.

Gestion des rôles

L'application distingue plusieurs rôles :

Utilisateur
Compte classique avec accès au profil, aux favoris et à l'historique.

Entreprise
Compte organisateur soumis à validation administrateur.
Un compte entreprise en attente conserve uniquement l'accès à l'accueil et au profil.
Un compte entreprise validé peut créer, modifier et gérer ses événements.

Administrateur
Compte disposant d'un accès à la gestion des utilisateurs, des entreprises et des événements.
L'administrateur valide les comptes entreprise et les événements avant leur publication.

Sécurité

Authentification JWT
Gestion des rôles (utilisateur / admin / entreprise)
Validation des données
Validation administrateur des comptes entreprise
Validation administrateur des événements avant publication
Protection contre les abus (rate limiting)

Planning

Le projet est organisé en plusieurs étapes :
Conception & cadrage
Développement frontend
Développement backend & données
Déploiement & tests

Équipe

Projet réalisé dans le cadre du titre RNCP Concepteur Développeur d'Applications (CDA).

Ce projet est développé en groupe de 3 personnes, avec une répartition des tâches (frontend, backend, gestion de projet) et une organisation basée sur Git et un board de suivi.
