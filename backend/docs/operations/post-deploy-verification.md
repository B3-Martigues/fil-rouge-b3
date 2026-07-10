# Verification apres deploiement

Ce guide donne les controles rapides a faire apres une mise en production, une
mise a jour d'infrastructure ou une rotation de secret.

## Prerequis

- URL publique du site, par exemple `https://mappening.fr`
- backend deploye
- variables d'environnement injectees
- migrations executees

## Verification minimale

1. `GET /api/health` repond `200`.
2. `http://...` redirige vers `https://...`.
3. Le login fonctionne depuis l'origine autorisee.
4. Le refresh de session fonctionne.
5. La reponse de login ou refresh contient un token CSRF dans le JSON ou dans
   le header `X-CSRF-Token`.
6. Une requete mutante sans `X-CSRF-Token` est refusee.
7. Les routes admin refusent un utilisateur non admin.
8. Un ancien refresh token est refuse apres changement de mot de passe.
9. La suppression ou desactivation du dernier administrateur actif est refusee.

## Script

Depuis `backend/` :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-deployment.ps1 -BaseUrl https://mappening.fr
```

Le script controle :

- l'acces a `/api/health`
- l'acces au frontend `/`
- le manifeste PWA et `sw.js`
- les headers publics de securite
- la redirection HTTP vers HTTPS

## Verification CI avant deploiement

Avant de deployer une revision, la CI doit passer les controles suivants :

```bash
gofmt
go build ./...
go vet ./...
go test -count=1 ./...
go test -race ./...
govulncheck ./...
```

Sur Windows local, `go test -race` demande un compilateur C disponible dans le
`PATH`. Si `gcc` est absent, s'appuyer sur la CI Linux pour ce controle.

## En cas d'echec

Verifier dans cet ordre :

1. Configuration du reverse proxy.
2. `TRUSTED_PROXY_CIDRS`.
3. `FRONTEND_URL`.
4. `CSRF_COOKIE_DOMAIN` si le front et l'API sont sur des sous-domaines separes.
5. `COOKIE_SECURE=true`.
6. Logs backend.
7. Logs proxy.
