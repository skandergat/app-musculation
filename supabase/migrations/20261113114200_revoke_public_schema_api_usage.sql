-- LIFTELY serves all application data through the Flask API using the
-- dedicated PostgreSQL connection. Supabase Data API roles must not access
-- the public schema directly, including objects created by platform roles.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon, authenticated, service_role;
