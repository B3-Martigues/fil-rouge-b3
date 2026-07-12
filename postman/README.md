# Vérification Postman de SafeBase

Importez `SafeBase.postman_collection.json` dans Postman, démarrez l'API issue de
l'image Docker, puis lancez la collection. La variable `baseUrl` vaut par défaut
`http://localhost:8080` et peut être remplacée pour un autre environnement.

La collection peut aussi être lancée en ligne de commande avec Newman :

```sh
npx newman run postman/SafeBase.postman_collection.json
```

Exemple de récupération et de lancement de l'image publiée :

```sh
docker pull ghcr.io/pawel-barc/safebase-api:latest
docker run --rm -p 8080:8080 --env-file backend/.env.local ghcr.io/pawel-barc/safebase-api:latest
```

L'API nécessite PostgreSQL et Redis. Les valeurs de connexion doivent pointer
vers des services joignables depuis le conteneur (évitez `127.0.0.1` pour des
services exécutés sur l'hôte).
