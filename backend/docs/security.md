# Securite

Ce document regroupe les protections principales du backend Mappening et les
points a verifier en production.

## Authentification

- Les acces utilisent des JWT HS256.
- Les refresh tokens sont stockes et renouveles cote serveur.
- Les cookies d'authentification sont `HttpOnly`.
- Les routes admin demandent le role `admin`.
- Les changements d'email, de role, de mot de passe ou d'activation revoquent les sessions existantes.
- Les operations qui peuvent retirer un acces admin actif sont protegees par
  transaction seriealisable et verrous en base afin de conserver au moins un
  administrateur actif.

## Mots de passe

- Les mots de passe sont hashes avec `bcrypt`.
- Les mots de passe ne doivent jamais etre journalises.
- La validation impose une longueur minimale et refuse les caracteres de controle.

Depuis `backend/` :

```bash
go run ./hash_password.go
```

Ne pas passer le mot de passe en argument de commande. Le programme lit le mot
de passe via un prompt masque ou via l'entree standard.

## Base de donnees

- Les requetes applicatives sont parametrees.
- Les roles PostgreSQL applicatif et migration doivent rester separes.
- Hors developpement, TLS doit etre actif sur les connexions PostgreSQL.

## CORS

- L'origine autorisee est definie par `FRONTEND_URL`.
- Les credentials sont autorises pour les cookies de session.
- Les headers `X-CSRF-Token` et `X-Request-Id` sont exposes au navigateur.
- En production, `FRONTEND_URL` doit etre en HTTPS.
- `FRONTEND_URL` doit etre une origine stricte, sans chemin ni query string.

## CSRF

- Les ecritures HTTP sont protegees par verification d'origine et double soumission du token CSRF.
- Le client recupere le token CSRF depuis la reponse de login/refresh
  (`csrf_token` ou header `X-CSRF-Token`) et renvoie sa valeur dans `X-CSRF-Token`.
- `CSRF_COOKIE_DOMAIN` peut etre defini sur un domaine parent controle si le
  front et l'API vivent sur des sous-domaines differents.
- Les flux de login non authentifies sont traites separement.

## Rate limiting

- Le login, le refresh et les ecritures admin sont limites.
- Le login combine une limite IP+route, une limite IP+email et une limite email
  globale pour reduire les attaques distribuees sur un meme compte.
- La table `http_rate_limits` doit etre purgee regulierement.

## Validation des entrees

- Les JSON recus sont stricts et refusent les champs inconnus.
- Les emails administrateur sont normalises et valides avant ecriture.
- Les noms utilisateur sont limites a la taille du schema et refusent les
  caracteres de controle.
- Les mots de passe sont limites en taille, refusent les blancs externes et les
  caracteres de controle.

## Dependances et CI

- `go vet`, `go build`, `go test -count=1`, `go test -race`, `gofmt` et
  `govulncheck` sont lances en CI.
- `govulncheck` doit rester sans vulnerabilite appelee par le code.
- Les dependances sensibles doivent etre mises a jour rapidement, notamment les
  bibliotheques de base de donnees, crypto, JWT et HTTP.

Exemple :

```sql
DELETE FROM http_rate_limits
WHERE updated_at < NOW() - INTERVAL '30 days';
```

## Reverse proxy

- Le backend applique des headers de securite HTTP.
- `TRUSTED_PROXY_CIDRS` doit contenir uniquement les IP ou CIDR des reverse proxies reels.
- Le reverse proxy doit ecraser les headers `X-Forwarded-*` recus du client.

## Checklist production

1. `ENV=production`
2. `JWT_SECRET` fort
3. `COOKIE_SECURE=true`
4. `FRONTEND_URL` en HTTPS
5. `DEV_LOGIN_ENABLED=false`
6. `CSRF_COOKIE_DOMAIN` vide ou limite a un domaine parent controle
7. `TRUSTED_PROXY_CIDRS` limite aux proxies controles
8. Roles PostgreSQL separes
9. Migrations executees avant demarrage
10. Sauvegardes de base configurees

## Ressources

- [`operations/deployment-environments.md`](operations/deployment-environments.md)
- [`operations/reverse-proxy-hardening.md`](operations/reverse-proxy-hardening.md)
- [`operations/secret-rotation.md`](operations/secret-rotation.md)
- [`postgres-production-bootstrap.sql.example`](postgres-production-bootstrap.sql.example)
- [`../.env.example`](../.env.example)
- [`../internal/http/router.go`](../internal/http/router.go)
