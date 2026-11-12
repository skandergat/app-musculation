# Migration PostgreSQL / Supabase — LIFTELY

## État vérifié au 12 novembre 2026

- Le schéma applicatif Supabase `public` contient les onze tables attendues.
- Les onze tables ont la Row Level Security activée.
- La table `exercices` contient 349 lignes ; les dix autres tables applicatives sont vides.
- L'import SQLite → PostgreSQL a été exécuté avec succès dans une transaction par GitHub Actions, run [43309393635](https://github.com/skandergat/app-musculation/actions/runs/43309393635).
- Le préflight n'a signalé aucun bloqueur ; les neuf clés étrangères correspondent ; le postflight a confirmé une égalité exacte du contenu des onze tables.
- Le test Flask sur la vraie base Supabase a validé `/health`, `/exercices` (337 exercices actifs et identifiants uniques) et le refus `401` de `/templates` sans authentification. Ce test n'a créé aucune donnée.
- L'historique Supabase contient les migrations `20261112205509_enable_rls_auth_login_limits` et `20261112212316_reconcile_auth_login_limits_table`.
- La source SQLite de staging a été conservée sans modification. Aucun compte ni historique utilisateur n'a été importé.
- Le service Render `liftely-api` n'a pas encore été basculé : il reste sur SQLite tant que `LIFTELY_DATABASE_URL` n'est pas configurée dans son environnement. Le code de compatibilité PostgreSQL est déjà présent dans `main`.
- Dernière étape de bascule : ajouter dans Render la même URI PostgreSQL protégée que celle utilisée par GitHub Actions, sous la variable `LIFTELY_DATABASE_URL`, puis vérifier le déploiement et les routes publiques. Ne jamais publier cette URI dans Git ou dans une conversation.

## Fichiers

- `postgres_schema.sql` : d?finition des onze tables applicatives, contraintes et index.
- `migrate_sqlite_to_postgres.py` : import transactionnel depuis SQLite. Par d?faut, refuse les tables cibles non vides ; avec `--allow-identical-existing`, accepte uniquement les tables dont le contenu complet correspond exactement ? la source, sans r?ins?rer les lignes.
- `migration_preflight.py` : comparaison en lecture seule du schéma, des index, des clés étrangères, des nombres de lignes et du contenu.
- `test_real_staging_migration.py` : test reproductible de la vraie fixture assainie sur un schéma PostgreSQL temporaire isolé.
- `fixtures/reset_staging_source.sql.gz.b64` : fixture de staging assainie, sans comptes ni historique.

## Base de référence validée

La fixture de staging contient exactement :

| Table | Lignes |
|---|---:|
| exercices | 349 |
| users | 0 |
| sessions | 0 |
| auth_action_tokens | 0 |
| auth_mail_limits | 0 |
| auth_login_limits | 0 |
| templates | 0 |
| template_exercices | 0 |
| seances | 0 |
| series | 0 |
| seance_exercices | 0 |

Cette fixture ne doit être utilisée que si elle correspond toujours à la source de données que le propriétaire souhaite conserver. Elle ne contient aucun ancien compte ni historique.

## Procédure contrôlée

1. Vérifier qu'une sauvegarde de la base source actuelle existe et confirmer que la fixture assainie est bien la source retenue.
2. Vérifier que les dix tables applicatives et leurs contraintes existent dans `public`. Si le schéma existe déjà, ne pas le recréer ni le supprimer. Pour une cible réellement vide, appliquer `postgres_schema.sql` uniquement dans `public`. Ne jamais exécuter de `DROP`, `TRUNCATE` ou de commande visant les schémas Supabase internes.
3. Depuis un environnement sécurisé disposant de la fixture SQLite et de la chaîne de connexion PostgreSQL, exécuter le préflight en lecture seule.
4. Si et seulement si le préflight ne signale aucun bloqueur, exécuter l'importeur avec `--source <base_staging.sqlite>`. L'importeur n'écrase aucune ligne existante et annule la transaction en cas d'erreur.
5. Relancer le préflight et exiger une correspondance exacte des onze tables, des clés étrangères et des séquences.
6. Vérifier les routes de l'API sur une configuration de test avant tout basculement de Render.
7. Configurer Render pour utiliser Supabase uniquement après validation explicite des contrôles précédents et conservation d'une possibilité de retour arrière.

## Mise à niveau d'un schéma PostgreSQL déjà initialisé

La protection anti-brute-force ajoute la table `auth_login_limits`. Si la base PostgreSQL a été initialisée avec une version antérieure du schéma, exécuter une seule fois dans le schéma applicatif (par exemple `public`) avant de déployer le nouveau backend :

```sql
CREATE TABLE IF NOT EXISTS auth_login_limits (
    key_hash TEXT PRIMARY KEY,
    window_start TEXT NOT NULL,
    request_count INTEGER NOT NULL
);
```

Cette opération ne modifie aucune donnée de compte ou d'entraînement et ne touche pas aux schémas internes Supabase.

## Exécution de l'importeur

Ne jamais placer une URI PostgreSQL, un mot de passe ou une clé Supabase dans Git, un fichier versionné ou une conversation. Utiliser une variable d'environnement protégée :

```powershell
$env:LIFTELY_DATABASE_URL = "<URI PostgreSQL saisie localement et protégée>"
python -m pip install -r .\backend\requirements.txt
python .\backend\migration_preflight.py --sqlite .\migration_staging.db --schema public
python .\backend\migrate_sqlite_to_postgres.py --source .\migration_staging.db
python .\backend\migration_preflight.py --sqlite .\migration_staging.db --schema public
```

Pour une première initialisation sur une cible vide, appliquer le schéma séparément avant l'import (ou utiliser `--create-schema` si l'environnement et la cible ont été explicitement vérifiés comme dédiés et vides).

## Garde-fous

- Ne pas définir `LIFTELY_DATABASE_URL` sur Render avant la fin du contrôle post-import.
- Ne pas utiliser la fixture assainie pour remplacer une base qui contiendrait des comptes ou de l'historique à conserver.
- Ne pas supposer que le bouton « Save » du SQL Editor exécute une requête : l'exécution est une action distincte.
- Ne jamais considérer le déploiement Render réussi comme preuve que la base Supabase est initialisée ou que l'application utilise PostgreSQL.


## Import Supabase depuis GitHub Actions

Un workflow manuel et protégé est disponible dans `.github/workflows/supabase-import.yml`.

1. Dans GitHub, ouvrir **Settings → Secrets and variables → Actions → New repository secret**.
2. Créer le secret `LIFTELY_DATABASE_URL` avec l'URI PostgreSQL de Supabase (privilégier la chaîne **Session pooler**, sans jamais la publier dans le dépôt ou une conversation).
3. Ouvrir **Actions → LIFTELY — initialisation contrôlée du schéma Supabase → Run workflow**.
4. Saisir exactement `INITIALISER_LIFTELY_SUPABASE` dans le champ de confirmation et lancer le workflow.

Le workflow reconstitue la fixture assainie depuis le d?p?t et v?rifie son int?grit?. Il exige que les dix tables autres que `exercices` soient vides. La table `exercices` peut ?tre vide ou contenir exactement les 349 lignes de la fixture ; dans ce dernier cas, le contenu complet doit correspondre et les lignes sont conserv?es sans r?insertion. Il bloque si le catalogue est partiel ou diff?rent, si le sch?ma ne correspond pas ou si le secret est absent. Le postflight exige une correspondance exacte du contenu des onze tables et des cl?s ?trang?res. Les rapports sont conserv?s comme artefact GitHub Actions pendant 14 jours.

**Ce workflow n'effectue aucun basculement Render.** Après l'import, il faudra encore valider les routes API avec PostgreSQL avant de configurer le service Render.
