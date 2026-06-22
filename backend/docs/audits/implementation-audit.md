# Audit d'implementation

## Date

9 avril 2026

## Statut

Mis a jour le 20 mai 2026. Les corrections critiques identifiees dans cet audit
ont ete appliquees et les controles automatises ont ete renforces.

## Resume

### Phase 1

- assainissement des secrets de developpement
- durcissement de `.env.example`
- clarification de la generation des secrets

### Phase 2

- ajout d'un script de purge des limites HTTP
- ajout d'un hook de pre-commit contre les fuites de secrets
- ajout d'une documentation de securite centralisee

### Phase 3

- verification de l'invalidation de session lors des changements utilisateur
- verification de la revocation des refresh tokens
- verification des protections CSRF et des controles d'authentification

### Phase 4

- protection transactionnelle des operations qui pourraient supprimer le dernier
  administrateur actif
- ajout d'un retour explicite du token CSRF dans les reponses login/refresh
- configuration optionnelle `CSRF_COOKIE_DOMAIN`
- validation stricte des emails et noms utilisateur avant ecriture SQL
- rate limiting login renforce avec un bucket email global
- mise a jour de `pgx` vers une version sans alerte `govulncheck`
- helper `hash_password` sans mot de passe en argument shell
- CI et script de detection de secrets durcis

## Fichiers produits

- [`../../.env.example`](../../.env.example)
- [`../../scripts/cleanup-rate-limits.sql`](../../scripts/cleanup-rate-limits.sql)
- [`../../scripts/pre-commit`](../../scripts/pre-commit)
- [`../security.md`](../security.md)
- [`../../.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)

## Actions restantes

1. Faire tourner les identifiants utilises avant correction si des secrets reels
   ont circule.
2. Verifier l'historique Git si des secrets ont ete exposes.
3. Generer un `JWT_SECRET` fort pour chaque environnement.
4. Installer le hook `pre-commit` sur les postes concernes.
5. Planifier la purge reguliere de `http_rate_limits`.
6. Rejouer les verifications de production documentees dans [`../security.md`](../security.md).
7. Confirmer en environnement cible que le front recupere bien le token CSRF
   depuis le JSON ou le header `X-CSRF-Token`.

## Suivi continu

- Revoir regulierement les dependances.
- Maintenir la separation stricte entre dev, staging et production.
- Programmer un nouvel audit lors de changements sensibles sur l'authentification, les uploads ou la surface admin.

## Documents de reference

- [`../security.md`](../security.md)
- [`../operations/deployment-environments.md`](../operations/deployment-environments.md)
- [`../../.env.example`](../../.env.example)

## Note

Cet audit sert de trace de suivi. La documentation normative a consulter au
quotidien est centralisee dans [`../security.md`](../security.md).
