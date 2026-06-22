# Documentation backend

Ce dossier regroupe la documentation du backend Mappening.

## Parcours rapide

1. Lire le demarrage local dans [`../README.md`](../README.md).
2. Comprendre l'architecture avec [`architecture/overview.md`](architecture/overview.md).
3. Verifier la configuration avec [`backend.md`](backend.md).
4. Preparer le deploiement avec [`operations/deployment-environments.md`](operations/deployment-environments.md).
5. Controler la securite avec [`security.md`](security.md).

## Architecture

- [`architecture/overview.md`](architecture/overview.md) : vue d'ensemble du backend
- [`architecture/project-structure.md`](architecture/project-structure.md) : organisation des dossiers

## Application

- [`backend.md`](backend.md) : configuration, execution, routes et composants
- [`security.md`](security.md) : protections et checklist de production

## Exploitation

- [`operations/deployment-environments.md`](operations/deployment-environments.md) : environnements, base PostgreSQL et premier admin
- [`operations/reverse-proxy-hardening.md`](operations/reverse-proxy-hardening.md) : exposition HTTPS derriere un reverse proxy
- [`operations/nginx.mappening.conf.example`](operations/nginx.mappening.conf.example) : exemple Nginx
- [`operations/post-deploy-verification.md`](operations/post-deploy-verification.md) : verification apres deploiement
- [`operations/secret-rotation.md`](operations/secret-rotation.md) : rotation des secrets
- [`postgres-production-bootstrap.sql.example`](postgres-production-bootstrap.sql.example) : exemple de bootstrap PostgreSQL

## Suivi

- [`audits/implementation-audit.md`](audits/implementation-audit.md) : trace d'audit, corrections de securite et actions restantes

## Regles

- Le README racine oriente vers `backend/`.
- Le README `backend/` sert au demarrage.
- Ce dossier contient les details durables.
- Les nouvelles pages doivent aller dans `architecture/`, `operations/`, `audits/` ou a la racine de `docs/` si elles sont transverses.
