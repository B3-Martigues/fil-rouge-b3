# Rotation des secrets

Ce guide decrit la rotation des secrets sensibles.

## Secrets concernes

- `JWT_SECRET`
- `APP_DB_PASSWORD`
- `MIGRATIONS_DB_PASSWORD`

## Quand tourner un secret

Rotation immediate si :

- un secret a ete commit
- un fichier `.env` a fuite
- un compte admin a ete compromis
- un poste de developpement a ete compromis
- des logs ou sauvegardes ont expose des identifiants

## `JWT_SECRET`

Impact :

- les JWT existants deviennent invalides
- les utilisateurs doivent se reconnecter

Procedure :

1. Generer un nouveau secret aleatoire fort.
2. Injecter le nouveau `JWT_SECRET`.
3. Redemarrer l'API.
4. Verifier login, refresh et logout.
5. Informer l'equipe qu'une reconnexion est attendue.

Depuis `backend/` :

```powershell
powershell -File scripts/generate-jwt-secret.ps1
```

## Mots de passe PostgreSQL

Procedure :

1. Creer un nouveau mot de passe pour le role cible.
2. Mettre a jour les secrets de la plateforme.
3. Redemarrer les composants qui utilisent ce secret.
4. Verifier la connexion applicative.
5. Revoquer l'ancien mot de passe.

Ordre recommande :

1. `MIGRATIONS_DB_PASSWORD`
2. `APP_DB_PASSWORD`

## Verification

Apres rotation :

1. Login utilisateur.
2. Refresh de session.
3. Acces aux routes admin.
4. Logs d'erreur backend.
5. Supervision et alertes.
