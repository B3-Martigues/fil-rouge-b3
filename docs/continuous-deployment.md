# Deploiement continu

Ce document decrit la preparation du deploiement continu de Mappening sur un
VPS Ubuntu avec Apache en reverse proxy.

## Principe

La pipeline `Deploy production` est declenchee apres une pipeline `CI` reussie
sur la branche `main`. Elle peut aussi etre lancee manuellement depuis GitHub
Actions avec `workflow_dispatch`.

Le workflow se connecte au VPS en SSH, se place dans le depot deja clone sur le
serveur, puis execute `scripts/deploy-production.sh`.

Le script de deploiement effectue les etapes suivantes :

1. mise a jour du depot en fast-forward depuis `main` ;
2. compilation du backend Go ;
3. compilation de l'outil de migrations ;
4. chargement des variables d'environnement de production ;
5. execution des migrations PostgreSQL ;
6. installation des binaires backend ;
7. installation des dependances frontend ;
8. build de production du frontend ;
9. publication des fichiers statiques ;
10. redemarrage du service `systemd` du backend ;
11. controle rapide de `/api/health`.

## Secrets GitHub requis

La pipeline ne contient aucun secret en clair. Les valeurs suivantes doivent
etre configurees dans GitHub Actions :

- `DEPLOY_SSH_HOST` : adresse du VPS ;
- `DEPLOY_SSH_USER` : utilisateur SSH utilise pour deployer ;
- `DEPLOY_SSH_PRIVATE_KEY` : cle privee SSH autorisee sur le serveur ;
- `DEPLOY_SSH_PORT` : port SSH, optionnel, `22` par defaut ;
- `DEPLOY_PATH` : chemin du depot sur le serveur, optionnel,
  `/var/www/mappening/source` par defaut ;
- `DEPLOY_APP_ROOT` : racine applicative, optionnel,
  `/var/www/mappening` par defaut.

## Prerequis serveur

Le serveur doit contenir :

- Go ;
- Node.js et npm ;
- PostgreSQL ;
- Redis ;
- Apache avec reverse proxy ;
- un depot Git clone dans `/var/www/mappening/source` ;
- un fichier d'environnement de production, par defaut
  `/etc/mappening/mappening.env` ;
- un service `systemd` nomme `mappening-api`.

## Variables de production

Le fichier `/etc/mappening/mappening.env` doit contenir les variables
necessaires au backend, par exemple :

```env
ENV=production
ADDR=127.0.0.1:8081
FRONTEND_URL=https://mappening.portfolio-pawel.dev
COOKIE_SECURE=true
JWT_SECRET=replace-with-production-secret
JWT_ISSUER=mappening
APP_DB_HOST=127.0.0.1
APP_DB_PORT=5432
APP_DB_NAME=mappening_prod
APP_DB_USER=mappening_user
APP_DB_PASSWORD=replace-with-password
APP_DB_SSLMODE=disable
MIGRATIONS_DB_HOST=127.0.0.1
MIGRATIONS_DB_PORT=5432
MIGRATIONS_DB_NAME=mappening_prod
MIGRATIONS_DB_USER=mappening_migrator
MIGRATIONS_DB_PASSWORD=replace-with-password
MIGRATIONS_DB_SSLMODE=disable
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
MEDIA_UPLOAD_DIR=/var/lib/mappening/uploads
PUBLIC_DOCS_ENABLED=false
DEV_LOGIN_ENABLED=false
MAIL_MODE=log
TARPIN_BIEN_SCRAPER_ENABLED=false
```

Les mots de passe et secrets doivent etre generes pour la production et ne
doivent jamais etre commit dans le depot.
