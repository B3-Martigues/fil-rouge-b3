# Vue d'ensemble

Le backend Mappening expose une API JSON sous `/api/*`.

Flux principal :

```text
Client HTTP -> routeur Go -> handlers -> repositories -> PostgreSQL
```

## Blocs principaux

- `cmd/api` : demarrage du serveur HTTP
- `cmd/migrate` : execution des migrations SQL
- `internal/http` : routeur, middlewares et composition HTTP
- `internal/auth` : login, JWT, refresh tokens et cookies
- `internal/users` : gestion des utilisateurs
- `internal/config` : lecture et validation de la configuration
- `internal/db` : connexion PostgreSQL et migrations
- `internal/httpx` : helpers HTTP partages
- `internal/logger` : initialisation des logs

## Requetes HTTP

1. Le client appelle une route sous `/api/*`.
2. Les middlewares appliquent logs, CORS, headers de securite, CSRF et JWT.
3. Le handler valide la requete.
4. Le repository lit ou modifie PostgreSQL.
5. La reponse est renvoyee en JSON.

## Flux d'authentification

1. `POST /api/auth/login` valide l'origine, le JSON et les identifiants.
2. Le backend emet un JWT d'acces, un refresh token et un token CSRF.
3. Les tokens d'authentification sont poses en cookies `HttpOnly`.
4. Le token CSRF est renvoye au client dans le JSON et dans le header
   `X-CSRF-Token`.
5. Les requetes mutantes suivantes doivent renvoyer ce token dans
   `X-CSRF-Token`.
6. `POST /api/auth/refresh` remplace le refresh token et le token CSRF.

## Administration utilisateurs

Les routes `/api/admin/*` exigent un utilisateur authentifie avec le role
`admin`.

Les changements qui modifient l'etat d'authentification d'un utilisateur
revoquent ses sessions. Les operations qui pourraient supprimer le dernier admin
actif sont controlees dans une transaction PostgreSQL seriealisable avec
verrouillage des admins actifs.

## Donnees conservees

La migration initiale crée :

- `users`
- `auth_refresh_tokens`
- `http_rate_limits`

## Evolution

Les futurs domaines metier peuvent etre ajoutes dans `internal/` avec le meme
decoupage : modele, repository, handler, tests et contrats HTTP.
