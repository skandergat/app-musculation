-- Keep the login-rate-limit table inaccessible through the public Data API.
-- The Flask backend connects with its privileged database role.
ALTER TABLE public.auth_login_limits ENABLE ROW LEVEL SECURITY;
