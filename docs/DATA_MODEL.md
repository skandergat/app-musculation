# Modèle de données et intégrité

## Source de vérité
Production : Supabase PostgreSQL 17.11, schéma public. Schéma de référence : backend/postgres_schema.sql. Évolutions : supabase/migrations/.

## Tables applicatives
| Table | Rôle |
|---|---|
| users | Comptes, hash mot de passe, vérification |
| exercices | Catalogue partagé, catégorie, groupe musculaire, actif |
| sessions | Jetons de session persistés sous forme de hash |
| auth_action_tokens | Jetons temporaires de vérification/reset/suppression |
| auth_mail_limits | Limitation des demandes e-mail |
| auth_login_limits | Limitation des tentatives de connexion |
| seances | Séances et dates début/fin, propriétaire |
| series | Charge/répétitions, référence séance et exercice |
| seance_exercices | Exercices d'une séance et ordre |
| templates | Modèles de séance appartenant à un utilisateur |
| template_exercices | Exercices et paramètres prévus d'un template |

## Règles d'intégrité
- Toute lecture/écriture de ressource privée doit être filtrée par l'utilisateur propriétaire, pas seulement par l'ID client.
- Les relations enfant suivent les contraintes de cascade et la logique de suppression.
- Les colonnes identity doivent avoir leurs séquences alignées après import.
- Les exercices inactifs sont conservés mais ne sont pas proposés comme actifs.
- Les contraintes uniques empêchent les doublons séance/exercice et template/exercice selon le schéma.
- Un index unique partiel protège l'unicité d'une séance active par utilisateur.

## État des données au dernier contrôle
- exercices : 349 lignes, IDs 1–349 ; 337 actives (185 gym, 152 calisthenics), 12 inactives.
- Les dix autres tables : 0 ligne au dernier contrôle. Refaire les COUNT avant toute opération de maintenance.

## Sécurité Supabase
RLS actif sur les 11 tables. Aucune policy RLS et aucun privilège table/séquence direct pour anon/authenticated au dernier contrôle ; aucune fonction ou vue publique. Les privilèges par défaut du rôle postgres ont également été révoqués pour les futurs objets afin d'empêcher leur exposition automatique par la Data API. L'API serveur utilise la connexion DB privilégiée. Le signal Advisor rls_enabled_no_policy est informatif dans ce modèle ; ne pas ajouter de policy permissive pour le faire disparaître. Réévaluer ensemble grants/policies si l'accès Supabase direct est introduit.

## Migration et sauvegarde
Préflight : backend/migration_preflight.py. Import : backend/migrate_sqlite_to_postgres.py. Tests : backend/test_sqlite_postgres_import.py, backend/test_real_staging_migration.py, backend/postgres_integration_smoke.py. Ne pas relancer le workflow d'import initial sur la production déjà peuplée.

Selon la documentation Supabase, le plan Free ne fournit pas de sauvegardes quotidiennes automatiques. Un export logique manuel chiffré et stocké hors du dépôt public est donc indispensable tant que le plan reste Free. Voir docs/OPERATIONS_RUNBOOK.md.
