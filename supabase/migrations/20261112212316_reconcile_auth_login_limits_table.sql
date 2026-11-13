CREATE TABLE IF NOT EXISTS public.auth_login_limits (
    key_hash TEXT PRIMARY KEY,
    window_start TEXT NOT NULL,
    request_count INTEGER NOT NULL
);
ALTER TABLE public.auth_login_limits ENABLE ROW LEVEL SECURITY;
