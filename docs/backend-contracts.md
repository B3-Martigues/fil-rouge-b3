# Contrats backend attendus

Ce document stabilise le modele attendu par le frontend avant le branchement API.

## Identites et droits

- `account` : identifiants de connexion, email, role global, statut actif/suspendu/supprime.
- `user_profile` : profil public rattache a un compte de role `user`, `admin` ou `moderator`.
- `organization` : fiche organisation, rattachee a un compte de role `organization` pour le compte principal.
- `organization_membership` : rattachement d'un utilisateur a une organisation, avec fonction et droits internes.
- `moderator_profile` : permissions fines de moderation (`review_events`, `review_organizations`, `moderate_events`, `suspend_accounts`, `manage_reports`).

Le role global donne acces a une zone applicative. Les permissions fines decident ensuite des vues et actions disponibles.

## Ressources metier

- `event` : evenement public ou en attente, rattache a une organisation, avec categorie(s), dates, lieu, statut et suspension.
- `moderation_report` : signalement d'un evenement, d'une organisation ou d'un compte.
- `moderation_decision` : journal immuable des decisions prises par moderation ou administration.
- `notification` : notification in-app/email generee par une decision ou un evenement favori.

## Integrations serveur

La meteo et l'email doivent passer par un endpoint backend ou un proxy serveur afin de garder les cles API et providers hors du client. Le frontend consomme uniquement des services normalises qui renvoient `ApiResult<T>`.
