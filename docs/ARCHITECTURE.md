# Architecture technique et cartographie du code

## Architecture
Le client Expo/React Native appelle l'API Flask par HTTPS, avec Bearer token pour les routes privées. Flask sélectionne PostgreSQL si LIFTELY_DATABASE_URL est défini, sinon SQLite en local. Le client mobile n'utilise pas directement la Data API Supabase et ne doit jamais recevoir une clé service_role.

## Cartographie
| Chemin | Responsabilité |
|---|---|
| mobile/src/app/_layout.tsx | Providers globaux, garde auth, thème, navigation |
| mobile/src/app/(auth)/ | Connexion, inscription, mot de passe oublié |
| mobile/src/app/(app)/index.tsx | Accueil/catalogue |
| mobile/src/app/(app)/seance.tsx | Séance active, exercices, séries |
| mobile/src/app/(app)/historique.tsx | Historique |
| mobile/src/app/(app)/progression.tsx | Progression |
| mobile/src/app/(app)/templates.tsx | Templates |
| mobile/src/app/(app)/profil.tsx | Profil |
| mobile/src/app/(app)/parametres.tsx | Paramètres |
| mobile/src/context/AuthContext.tsx | Inscription, login, session, jeton |
| mobile/src/context/I18nContext.tsx | FR/EN/DE/AR et traductions |
| mobile/src/context/ColorSchemeContext.tsx | Thème |
| mobile/src/config/api.ts | URL API, timeout, fetch |
| mobile/src/constants/theme.ts | Tokens visuels |
| backend/app.py | Routes, auth, métier, e-mails, pages publiques |
| backend/db_compat.py | Sélection/compatibilité SQLite/PostgreSQL |
| backend/postgres_schema.sql | Schéma PostgreSQL de référence |
| backend/migration_preflight.py | Préflight en lecture seule |
| backend/migrate_sqlite_to_postgres.py | Import transactionnel |
| backend/postgres_integration_smoke.py | Smoke test PostgreSQL |
| backend/account_lifecycle_smoke.py | Parcours compte |
| backend/account_isolation_smoke.py | Isolation inter-comptes |
| backend/security_smoke.py | Contrôles sécurité |\n| scripts/backup-supabase.ps1 | Dump PostgreSQL et archive 7-Zip chiffrée pour sauvegarde manuelle |
| supabase/migrations/ | Migrations versionnées |
| .github/workflows/ci.yml | CI backend + mobile |
| .github/workflows/postgres-integration.yml | Tests PostgreSQL isolés |
| .github/workflows/supabase-import.yml | Workflow historique d'import contrôlé ; ne pas relancer sur production |

## Navigation
Expo Router sépare les groupes (auth) et (app). Le layout racine enveloppe l'application dans I18nProvider, ColorSchemeProvider et AuthProvider. Les écrans privés ne sont affichés que lorsque l'utilisateur est chargé et connecté.

## Authentification
Il s'agit d'un système d'authentification applicatif maison, pas de Supabase Auth. Flask vérifie les mots de passe (PBKDF2-HMAC-SHA256 avec sel), crée les jetons de session et stocke leur hash. Les jetons d'action e-mail sont à usage unique et stockés sous forme de hash. Le client stocke le jeton natif dans Expo SecureStore ; le Web utilise le stockage local.

## API — santé, pages publiques, auth
- GET /health
- GET /privacy ; GET /account-deletion
- GET /email/verify ; GET /email/reset-password ; GET /email/delete-account
- POST /auth/register ; POST /auth/verify-email-request ; POST /auth/verify-email
- POST /auth/login ; POST /auth/password-reset-request ; POST /auth/password-reset
- GET /auth/me ; POST /auth/logout
- POST /auth/account-deletion-request ; POST /auth/account-delete-confirm
- DELETE /auth/account

## API — entraînement
- GET /exercices
- POST /seances ; GET /seances/active
- POST /seances/{id}/exercices ; PUT /seances/{id}/exercices/reorder
- DELETE /seances/{id}/exercices/{exercise_id}
- POST /seances/{id}/series ; PUT /seances/{id}/series/{series_id} ; DELETE /seances/{id}/series/{series_id}
- POST /seances/{id}/annuler ; POST /seances/{id}/terminer
- GET /exercices/{id}/previous
- GET /historique ; GET /progression

## API — templates
- GET/POST /templates
- GET/PUT/DELETE /templates/{id}
- POST /templates/{id}/exercices
- DELETE /templates/{id}/exercices/{exercise_id}
- PUT /templates/{id}/exercices/reorder
- POST /templates/{id}/start

Les routes privées exigent un Bearer token et doivent vérifier la propriété de la ressource. Les codes de réponse et validations exactes sont définis dans backend/app.py.

## Flux et limites
Le catalogue est partagé. Comptes, séances, séries, templates et sessions sont privés et isolés par utilisateur. La suppression de compte supprime les données actives liées au compte. L'API est actuellement monolithique dans backend/app.py ; toute modularisation doit préserver les frontières de sécurité et les tests. Render Oregon ↔ Supabase Londres crée une latence inter-région. L'authentification maison doit faire l'objet d'une revue sécurité avant montée en charge.
