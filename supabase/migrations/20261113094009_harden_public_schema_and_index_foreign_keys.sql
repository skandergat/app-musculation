-- LIFTELY production hardening: least-privilege Data API access and FK indexes.
-- The Flask API connects directly as the privileged postgres role; mobile uses
-- Flask rather than Supabase Data API credentials. RLS remains enabled.

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id
    ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_template_exercices_exercice_id
    ON public.template_exercices(exercice_id);
CREATE INDEX IF NOT EXISTS idx_seance_exercices_exercice_id
    ON public.seance_exercices(exercice_id);
CREATE INDEX IF NOT EXISTS idx_series_seance_id
    ON public.series(seance_id);
CREATE INDEX IF NOT EXISTS idx_series_exercice_id
    ON public.series(exercice_id);

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
    FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
    FROM anon, authenticated;
