# LIFTELY backend — modularization plan

## Current verified structure
- `backend/app.py` owns Flask app construction, security headers/CORS, request cleanup, health endpoints, password/token helpers, authentication routes, email delivery, and workout routes.
- `backend/db_compat.py` provides SQLite/PostgreSQL connection selection and a compatibility adapter for placeholders, row access, and identity inserts.
- `backend/postgres_schema.sql` is the explicit PostgreSQL schema; the application intentionally does not auto-create PostgreSQL schema at startup.
- `backend/requirements.txt` includes Flask, Argon2, Gunicorn, and psycopg.

## Target package layout
```text
backend/
  app.py                 # application factory / WSGI entrypoint
  config.py              # validated environment configuration
  db/
    connection.py        # connection factory and adapter
    migrations/          # versioned schema changes
  routes/
    health.py
    auth.py
    accounts.py
    workouts.py
    templates.py
  services/
    authentication.py
    email.py
    exercise_catalog.py
    workout_service.py
  repositories/
    users.py
    sessions.py
    exercises.py
    workouts.py
  security/
    passwords.py
    tokens.py
    rate_limits.py
  tests/
```

## Safe extraction order
1. Add characterization tests around current API status codes, payloads, authentication, and ownership boundaries.
2. Extract configuration and connection selection without changing behavior.
3. Extract password hashing, token hashing, and rate-limit helpers.
4. Extract email delivery behind one service interface; keep sandbox checks separate from delivery.
5. Extract health and authentication blueprints, then account and workout blueprints.
6. Introduce repositories only where they remove duplicated SQL; avoid a broad ORM rewrite.
7. Run SQLite unit tests and PostgreSQL integration tests after every extraction.

## Invariants
- Preserve all public endpoint paths, request/response shapes, and status codes.
- Never allow an implicit SQLite fallback in staging or production when PostgreSQL is expected.
- Keep tenant ownership predicates on every user-owned read/write.
- Never put secrets in source control or logs.
- No refactor is complete until unit, integration, security, and mobile contract tests pass.

## Not yet changed
This is an evidence-based plan, not a completed refactor. Large-scale module moves are intentionally deferred until route and data-access characterization tests cover the current monolith.