# Reverse proxy

Ce guide donne une base pour exposer l'API en production derriere un reverse
proxy.

## Objectif

Le backend suppose que :

- le TLS est termine au proxy ou au load balancer
- seuls des proxies de confiance injectent les headers forwarded
- les headers `X-Forwarded-*` recus du client sont ecrases
- l'API n'est pas exposee directement sur Internet quand ce modele est utilise

## Variables backend

Exemple minimal :

```env
ENV=production
FRONTEND_URL=https://app.example.fr
COOKIE_SECURE=true
CSRF_COOKIE_DOMAIN=example.fr
TRUSTED_PROXY_CIDRS=127.0.0.1,10.42.0.0/16
```

Regles :

- `FRONTEND_URL` doit etre l'origine exacte du client navigateur autorise.
- `FRONTEND_URL` ne doit pas contenir de chemin, query string ou credentials.
- `CSRF_COOKIE_DOMAIN` reste optionnel; utilisez-le seulement pour un domaine
  parent controle quand le front et l'API sont sur des sous-domaines differents.
- `TRUSTED_PROXY_CIDRS` doit contenir uniquement les IP ou CIDR des proxies reels.
- `0.0.0.0/0` ne doit pas etre utilise.

## Nginx

Un exemple complet est disponible ici :
[`nginx.mappening.conf.example`](nginx.mappening.conf.example).

Points importants dans la configuration :

- rediriger HTTP vers HTTPS
- envoyer `X-Forwarded-Proto https`
- ecraser `X-Forwarded-For` avec l'adresse du client vue par le proxy
- ne pas relayer tel quel les headers forwarded fournis par le client

## Verification

Apres deploiement :

1. `https://api.mappening.example.fr/api/health` repond en HTTPS.
2. Le backend renvoie `Strict-Transport-Security`.
3. Les cookies `access_token` et `refresh_token` sont `Secure`.
4. Le login echoue depuis une origine non autorisee.
5. Les logs montrent des IP client coherentes.

## Autres proxies

Les memes principes s'appliquent avec Traefik, Caddy ou un load balancer :

- terminaison TLS fiable
- reecriture des `X-Forwarded-*`
- IP proxy explicites dans `TRUSTED_PROXY_CIDRS`
- API privee derriere le proxy quand c'est possible
