-- Keep every LIFTELY application table inaccessible through Supabase Data API.
-- The mobile app talks to Flask; Flask connects using the privileged PostgreSQL role.
-- This migration is idempotent and makes a fresh staging project match production.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_mail_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_login_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seance_exercices ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
    FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
    FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public
    FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated, service_role, PUBLIC;
