# Migration PostgreSQL / Supabase — LIFTELY

## État au 1er novembre 2026

- Le dépôt `main` contient l'adaptateur PostgreSQL (`backend/db_compat.py`) et son intégration dans `backend/app.py`.
- Les tests d'intégration PostgreSQL ont réussi sur une instance PostgreSQL isolée en CI, avec la base de staging assainie : 349 exercices, neuf tables applicatives vides, comparaison exacte des onze tables et vérification des clés étrangères et séquences.
- Le projet Supabase de production a été inspecté en lecture seule : le schéma `public` ne contient actuellement aucune table applicative LIFTELY. Les schémas internes Supabase (`auth`, `storage`, etc.) sont présents et ne doivent pas être modifiés.
- Le service Render `liftely-api` déploie le commit de migration, mais aucune instance PostgreSQL Render n'est attachée. La présence et la valeur de la variable de connexion Supabase dans Render n'ont pas été vérifiées.
- **Aucune migration de production n'a été exécutée et aucun changement de configuration Render n'a été effectué.** Tant que le schéma et les données ne sont pas importés puis vérifiés dans Supabase, le backend doit rester sur sa base actuelle.

## Fichiers

- `postgres_schema.sql` : définition des onze tables applicatives, contraintes et index.
- `migrate_sqlite_to_postgres.py` : import transactionnel depuis une base SQLite vers un schéma PostgreSQL vide. Refuse toute table cible contenant déjà des lignes et vérifie les contenus importés.
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
2. Appliquer `postgres_schema.sql` uniquement au schéma `public` vide du projet Supabase cible. Ne jamais exécuter de `DROP`, `TRUNCATE` ou de commande visant les schémas Supabase internes.
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
3. Ouvrir **Actions → LIFTELY — import contrôlé des 349 exercices vers Supabase → Run workflow**.
4. Saisir exactement `IMPORTER_349_EXERCICES` dans le champ de confirmation et lancer le workflow.

Le workflow reconstitue la fixture assainie depuis le dépôt, vérifie son intégrité, exige que les onze tables `public` soient vides et que le schéma soit compatible, puis lance l'import transactionnel. Il bloque si la cible n'est pas vide, si la source diffère, si le schéma ne correspond pas ou si le secret est absent. Le postflight exige une correspondance exacte du contenu des onze tables et des clés étrangères. Les rapports sont conservés comme artefact GitHub Actions pendant 14 jours.

**Ce workflow n'effectue aucun basculement Render.** Après l'import, il faudra encore valider les routes API avec PostgreSQL avant de configurer le service Render.
