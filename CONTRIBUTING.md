# Contribuer à LIFTELY

## Principes
- Ne pas committer directement sur main ; utiliser une branche et une Pull Request.
- Garder une PR ciblée, expliquer les risques et joindre les preuves de tests.
- Aucun secret, export de production ou donnée personnelle dans Git.
- Ne jamais exécuter les tests destructifs ou migrations sur Supabase production.
- Les changements de schéma doivent être ajoutés à supabase/migrations/ et testés sur PostgreSQL isolé.

## Mobile
Depuis mobile/ :
~~~powershell
npm ci
npm run check:translations
npm run lint
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
~~~

Pour les dépendances Expo, utiliser npx expo install. Ne jamais utiliser npm audit fix --force ni downgrader le SDK pour faire disparaître un avis de sécurité.

Toute nouvelle clé de traduction doit exister dans les quatre langues FR, EN, DE et AR. Vérifier le rendu RTL pour l'arabe.

## Backend
Depuis la racine :
~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe -m unittest backend.test_health
~~~

Exécuter aussi les scripts smoke pertinents contre une base locale ou PostgreSQL isolé.

## Base de données
- Lire backend/POSTGRES_MIGRATION.md et docs/DATA_MODEL.md.
- Ajouter une migration horodatée, idempotente lorsque possible.
- Vérifier l'historique Supabase avant toute application.
- Comparer les ACL, index, contraintes et données après migration.
- Ne pas rejouer le workflow d'import initial sur la production existante.
- Toute opération destructive nécessite sauvegarde vérifiée et accord explicite du propriétaire.

## Pull Request
Compléter .github/PULL_REQUEST_TEMPLATE.md. Attendre la CI verte et la revue avant fusion. Aucun auto-merge pour les dépendances ou les migrations.
