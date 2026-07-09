# Tests de l'application Mappening

Ce document couvre la base de tests CDA pour le frontend, le backend et les traitements automatiques.

## Commandes

Depuis la racine du projet :

```bash
npm run test:backend
npm run test:frontend
npm run test:e2e
npm run test:all
```

Commandes Makefile equivalentes :

```bash
make test-backend
make test-frontend
make test-e2e
make test-all
```

Commandes directes :

```bash
cd backend && go test ./...
npm --prefix frontend run test:e2e
```

## Tests fonctionnels frontend

La suite E2E Playwright se trouve dans `frontend/tests/e2e`.

Scenarios automatises :

- consultation des evenements sur la carte interactive avec donnees API mockees ;
- recherche, filtrage par tarif et tri des evenements ;
- acces aux pages inscription et connexion ;
- favoris, historique, preferences et notifications utilisateur ;
- creation d'organisation et creation d'evenement cote organisateur ;
- acces moderation ;
- refus d'acces administration pour moderateur ;
- acces administration pour administrateur.

Les tests mockent les endpoints API principaux pour rester rapides, deterministes et independants d'une base locale. Ils verifient les parcours de navigation, les roles et les elements visibles attendus.

## Tests API backend

La suite Go existante et completee couvre :

- authentification, login, erreurs 401, refresh token et rotation de cookies ;
- validation JSON stricte et erreurs de donnees ;
- middlewares JWT, CSRF, headers de securite et rate limiting ;
- endpoints admin/proteges avec matrice 401/403 ;
- handlers evenements, organisations, utilisateurs, media, geocoding ;
- repositories lorsque les tests disposent d'un contexte isole ;
- contrats DTO backend.

Le fichier `backend/internal/http/access_matrix_test.go` ajoute une matrice explicite :

- visiteur : acces public uniquement, 401 sur route protegee ;
- utilisateur connecte : refus 403 sur administration ;
- organisation : refus 403 sur roles staff ;
- moderateur : acces staff autorise, administration refusee ;
- administrateur : acces staff autorise.

## Traitements automatiques

Couverture automatisee :

- scraping Tarpin Bien : parsing et normalisation dans `backend/internal/scraping/tarpin_bien_test.go` ;
- scheduler : calcul de la prochaine execution quotidienne dans `backend/internal/scraping/scheduler_test.go` ;
- refresh token et invalidation par revision de session dans `backend/internal/auth/handler_test.go` ;
- cache geocoding et suggestion dans `backend/internal/geocoding/handler_test.go`.

Limites :

- la mise a jour Redis est verifiee via les composants qui consomment le cache, mais aucun test d'integration Redis reel n'est lance par defaut ;
- les notifications email ne sont pas envoyees en test automatise, elles doivent etre verifiees avec un mailer de dev ou des logs applicatifs ;
- le scraping planifie complet depend du reseau externe et doit rester en procedure manuelle ou environnement de recette.

## Procedures manuelles CDA

Captures d'ecran a prevoir pour le dossier :

- carte interactive avec au moins deux marqueurs et la liste d'evenements ;
- recherche puis filtre par tarif ;
- formulaire d'inscription utilisateur ;
- connexion reussie ;
- pages favoris, historique, preferences, notifications ;
- formulaire creation organisation ;
- formulaire creation/modification evenement ;
- tableau moderation organisations/evenements ;
- traitement d'un signalement ;
- tableau administration comptes/utilisateurs.

Verification manuelle recommandee avant soutenance :

1. Lancer le backend, Redis et la base via la procedure projet.
2. Lancer le frontend avec `npm --prefix frontend run dev`.
3. Se connecter avec un compte utilisateur, moderateur et administrateur.
4. Executer les parcours ci-dessus avec des donnees de test dediees.
5. Conserver les captures avec une date et un compte de test identifiable.
