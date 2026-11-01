# Migration PostgreSQL / Supabase — LIFTELY

## État

Cette branche prépare le schéma PostgreSQL et un importeur contrôlé. L'adaptateur utilise `LIFTELY_DATABASE_URL` comme variable canonique (les alias `SUPABASE_DB_URL` et `DATABASE_URL` restent temporairement compatibles). **Elle ne bascule pas encore l'application Flask vers PostgreSQL** : `backend/app.py` utilise toujours l'API SQLite (placeholders `?`, `lastrowid`, `PRAGMA`, initialisation SQLite). Ne configure pas encore Render pour pointer vers Supabase et ne fusionne pas cette branche en production avant l'adaptation et les tests du backend.

## Fichiers

- `postgres_schema.sql` : tables, clés étrangères et index PostgreSQL.
- `migrate_sqlite_to_postgres.py` : import transactionnel de la base de staging vers une cible PostgreSQL vide.
- `requirements.txt` : ajoute Psycopg 3.
- `postgres_integration_smoke.py` et `.github/workflows/postgres-integration.yml` : tests contre un service PostgreSQL isolé en CI.

## Conditions de sécurité

1. Garde les deux bases SQLite originales et `migration_staging.db` en sauvegarde.
2. Utilise un projet / une base Supabase de test ou une base cible vide.
3. Ne mets jamais l'URI ou le mot de passe PostgreSQL dans le code, GitHub ou le chat. Utilise une variable d'environnement.
4. L'importeur refuse de continuer si une des tables cibles contient déjà des lignes. Il n'efface aucune table et ne modifie pas le fichier SQLite source.
5. L'import est transactionnel : une erreur annule toute la transaction.
6. Après import, compare les comptes et les relations avant toute bascule.

## Préparation de la base cible

Dans PowerShell, depuis le dossier du projet, avec Python et les dépendances backend installées :

```powershell
$env:LIFTELY_DATABASE_URL = Read-Host "URI PostgreSQL Supabase (saisie masquée recommandée via un gestionnaire de secrets)"
python -m pip install -r .\backend\requirements.txt
python .\backend\migrate_sqlite_to_postgres.py --source .\migration_staging.db --create-schema
```

La saisie via `Read-Host` n'est pas masquée dans PowerShell ; privilégie un gestionnaire de secrets ou définis la variable hors historique de commande. Ne copie pas l'URI dans un terminal partagé ou dans une conversation. Si le mot de passe de la base a déjà été exposé, renouvelle-le dans Supabase avant utilisation.

## À faire avant la production

- Adapter l'accès DB de `backend/app.py` à Psycopg, notamment paramètres SQL, récupération des identifiants, gestion des transactions et exceptions d'intégrité.
- Séparer l'initialisation PostgreSQL de l'initialisation SQLite.
- Ajouter des tests d'intégration sur une base PostgreSQL isolée : inscription/connexion, vérification et réinitialisation d'e-mail, séances, séries, templates, suppression de compte et erreurs de contraintes.
- Vérifier le contenu complet de chaque table, les comptages et les séquences après import.
- Confirmer l'absence de doublons actifs `(nom, categorie)` dans le catalogue avant l'application de l'index unique.
- Configurer Render uniquement après réussite de ces tests, puis tester les routes et l'application.
