-- ============================================================================
-- Nettoyage de la table de limitation HTTP
-- ============================================================================
--
-- OBJECTIF:
--   Eviter le grossissement inutile de la base en supprimant les anciennes
--   entrees de limitation HTTP.
--   Cette requete doit etre executee periodiquement via un cron.
--
-- RECOMMANDATION DE PLANIFICATION:
--   - Quotidien: suppression des entrees de plus de 30 jours
--   - Cette retention conserve quelques semaines d'historique recent
--
-- EXEMPLE DE PLANIFICATION AVEC pg_cron:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *',
--     'DELETE FROM http_rate_limits WHERE updated_at < NOW() - INTERVAL ''30 days''');
--
-- ============================================================================

BEGIN;

-- Supprime les entrees de plus de 30 jours
DELETE FROM http_rate_limits
WHERE updated_at < NOW() - INTERVAL '30 days';

-- Journalise le nombre de lignes supprimees
RAISE NOTICE 'Suppression effectuee sur % entree(s) expiree(s)', FOUND::int;

-- Optionnel: vacuum et analyse pour recuperer de l'espace
-- VACUUM ANALYZE http_rate_limits;

COMMIT;
