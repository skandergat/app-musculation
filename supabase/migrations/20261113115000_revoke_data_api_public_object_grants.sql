-- The mobile app never uses Supabase Data API. All application access
-- goes through Flask using the dedicated PostgreSQL connection.
-- Remove existing object-level grants from all Data API roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
    FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
    FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public
    FROM anon, authenticated, service_role;
