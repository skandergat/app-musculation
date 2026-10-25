# LIFTELY database migration decision record

**Status: migration blocked pending an explicit source-of-truth decision.**  
**Last local SQLite comparison: 2026-10-25.**

## Current database evidence

Two different local SQLite files were inspected:

| Table | Project-root `musculation.db` | `backend/musculation.db` |
|---|---:|---:|
| `exercices` | 349 | 349 |
| `users` | 3 | 2 |
| `sessions` | 5 | 8 |
| `seances` | 45 | 43 |
| `series` | 64 | 51 |
| `templates` | absent | 2 |
| `template_exercices` | absent | 4 |
| `auth_action_tokens` | absent | 4 |
| `auth_mail_limits` | absent | 3 |
| `seance_exercices` | absent | 11 |

The two files are not interchangeable copies. The rows with matching IDs include conflicting user/account fields and conflicting workout-history references/values. In particular, matching session and series IDs do not establish that the records refer to the same real workout.

## Required decision before migration

1. Preserve both source files as immutable backups.
2. Decide which database is authoritative for accounts and workout history. Do not choose based only on file size, row count, or modification time.
3. If data from both files must be retained, design an explicit reconciliation map for users, sessions, workouts, series, templates, and exercise references. Do not merge rows by numeric ID.
4. Keep the production Render database setting unchanged until a migration plan has been reviewed and tested.
5. Run `backend/migration_preflight.py` against a dedicated, disposable PostgreSQL/Supabase test database. It opens SQLite read-only and PostgreSQL in a read-only transaction.
6. Validate schema, foreign keys, row-content comparison, account flows, workout CRUD, templates, and sequence/identity behavior on the isolated target.
7. Back up the chosen source, run a controlled migration, then verify row counts, row content, relationships, and application smoke tests before any production cutover.

## What CI can and cannot prove

The GitHub Actions workflow uses a disposable PostgreSQL 16 service to test adapter compatibility and backend flows. This is useful integration evidence, but it is **not** a connection to the user's Supabase project. Supabase-specific validation remains pending until an isolated Supabase test project and its connection string are available. Never paste a database password into chat or commit it to the repository.

## Current safety rule

No automatic merge of the two SQLite files, no destructive cleanup of source records, no production database switch, and no migration into the production Supabase project.
