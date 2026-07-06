# Documentation backend

Ce dossier regroupe la documentation durable du backend Mappening.

## Parcours rapide

1. Lire le démarrage local dans [`../README.md`](../README.md).
2. Comprendre l'architecture avec [`architecture/overview.md`](architecture/overview.md).
3. Vérifier la configuration, les commandes et les routes dans [`backend.md`](backend.md).
4. Préparer le déploiement avec [`operations/deployment-environments.md`](operations/deployment-environments.md).
5. Contrôler la sécurité avec [`security.md`](security.md).
6. Consulter l'audit d'implémentation avec [`audits/implementation-audit.md`](audits/implementation-audit.md).

## Architecture

- [`architecture/overview.md`](architecture/overview.md) : vue d'ensemble du backend, des couches et des flux principaux.
- [`architecture/project-structure.md`](architecture/project-structure.md) : organisation des dossiers et responsabilités des modules.

## Application

- [`backend.md`](backend.md) : configuration, exécution, routes et composants backend.
- [`security.md`](security.md) : protections HTTP, authentification, checklist de production et points de vigilance.

Le backend couvre actuellement l'authentification, les utilisateurs, les organisations, les événements, les favoris, l'historique, les médias, les notifications, la modération, le scraping Tarpin Bien, Redis et PostgreSQL.

## Exploitation

- [`operations/deployment-environments.md`](operations/deployment-environments.md) : environnements, base PostgreSQL, secrets et premier admin.
- [`operations/reverse-proxy-hardening.md`](operations/reverse-proxy-hardening.md) : exposition HTTPS derrière un reverse proxy.
- [`operations/nginx.mappening.conf.example`](operations/nginx.mappening.conf.example) : exemple de configuration Nginx.
- [`operations/post-deploy-verification.md`](operations/post-deploy-verification.md) : vérification après déploiement.
- [`operations/secret-rotation.md`](operations/secret-rotation.md) : rotation des secrets.
- [`postgres-production-bootstrap.sql.example`](postgres-production-bootstrap.sql.example) : exemple de bootstrap PostgreSQL production.

## Suivi

- [`audits/implementation-audit.md`](audits/implementation-audit.md) : trace d'audit, corrections de sécurité et actions restantes.

## Règles de documentation

- Le README racine présente le projet complet.
- Le README `backend/` sert au démarrage backend et au résumé opérationnel.
- Ce dossier contient les détails durables.
- Les nouvelles pages doivent aller dans `architecture/`, `operations/`, `audits/` ou à la racine de `docs/` si elles sont transverses.
- Les changements de routes, configuration, sécurité, migrations ou exploitation doivent être répercutés ici ou dans `backend/README.md`.
