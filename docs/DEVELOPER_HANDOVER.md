# Dossier de reprise technique — LIFTELY

## Objet
Permettre à un développeur, une agence ou un acquéreur technique de reprendre le dépôt, comprendre le produit, lancer un environnement local, tester les parcours, exploiter l'API et maintenir la production sans dépendre des conversations précédentes.

Dépôt : https://github.com/skandergat/app-musculation. Le dépôt est actuellement public : aucun secret ne doit y être placé. Les accès, factures, domaines et moyens de paiement sont transférés séparément.

## Architecture
~~~text
iOS / Android / Web
       |
       v
Expo / React Native (Bearer token)
       |
       v
Render: liftely-api (Flask + Gunicorn, Oregon)
       |
       | LIFTELY_DATABASE_URL (secret)
       v
Supabase PostgreSQL 17.11 (London, eu-west-2)

Flask -- HTTPS API --> Brevo (transactional email)
GitHub Actions --> tests, lint, TypeScript, export web, Expo Doctor
~~~

## Comptes fournisseurs à transférer
- GitHub : dépôt, branches, PR, Actions, secrets et protections.
- Render : workspace, service, variables, déploiements et facturation.
- Supabase : organisation, projet, base, clés, sauvegardes et facturation.
- Brevo : organisation, expéditeur/domaine validé, clé API et délivrabilité.
- Expo/EAS : organisation, projet et credentials.
- Apple Developer / App Store Connect et Google Play Console, si créés.
- Domaine/DNS, e-mail support et contact confidentialité, si créés.

Utiliser les invitations nominatives et un coffre-fort de mots de passe. Ne jamais partager un mot de passe dans un fichier ou un e-mail en clair. Révoquer les anciens accès après validation du transfert.

## Démarrage local — mobile
Prérequis : Git, Node.js LTS compatible avec SDK 57 (Node 22 utilisé en CI), npm.

~~~powershell
git clone https://github.com/skandergat/app-musculation.git
cd app-musculation
cd mobile
npm ci
npx.cmd expo start --clear
~~~

Si le téléphone ne rejoint pas le réseau local : npx.cmd expo start --clear --tunnel.

Contrôles :
~~~powershell
npm.cmd run check:translations
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor
npx.cmd expo export --platform web
~~~

## Démarrage local — backend
Depuis la racine :
~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe .\backend\app.py
~~~

L'API écoute sur le port 5001. Sans LIFTELY_DATABASE_URL, le backend utilise SQLite, par défaut backend/musculation.db (sauf LIFTELY_DB_PATH). Pour tester depuis un téléphone, utiliser l'IP LAN du PC, jamais localhost. En production, EXPO_PUBLIC_API_URL doit être HTTPS.

## Variables d'environnement
Mobile :
- EXPO_PUBLIC_API_URL : URL de l'API incorporée au bundle ; publique, jamais de secret.

Backend/Render :
- LIFTELY_DATABASE_URL : URI PostgreSQL, secret critique.
- LIFTELY_PUBLIC_BASE_URL : origine HTTPS des liens d'action.
- LIFTELY_BREVO_API_KEY : clé API Brevo, secret critique.
- LIFTELY_EMAIL_FROM, LIFTELY_EMAIL_SENDER_NAME, LIFTELY_EMAIL_PROVIDER : expéditeur/fournisseur.
- LIFTELY_SMTP_HOST, PORT, USERNAME, PASSWORD, USE_SSL : fallback SMTP ; mot de passe secret.
- LIFTELY_CORS_ORIGINS : allowlist exacte des origines Web.
- LIFTELY_DATA_CONTROLLER, LIFTELY_DATA_CONTROLLER_ADDRESS, LIFTELY_PRIVACY_CONTACT : informations juridiques à fournir.
- LIFTELY_HOSTING_PROVIDER, LIFTELY_HOSTING_REGION, LIFTELY_BACKUP_RETENTION, LIFTELY_LOG_RETENTION : inventaire confidentialité, ne pas inventer les durées.
Voir backend/.env.example, docs/OPERATIONS_RUNBOOK.md et scripts/backup-supabase.ps1 pour les sauvegardes chiffrées.

## Fonctionnalités actuelles
Inscription, confirmation e-mail, connexion/déconnexion, reset mot de passe, suppression de compte, catalogue Gym/Calisthenics, séances et séries, templates, historique, progression, profil, paramètres, FR/EN/DE/AR, thème clair/sombre.

## Avant chaque modification
1. Lire le présent dossier.
2. Créer une branche dédiée.
3. Exécuter CI générale et tests PostgreSQL isolés.
4. Ne jamais tester des écritures sur la base de production.
5. Ouvrir une PR avec risques, preuves de test et rollback.
6. Après fusion, vérifier Render, /health, /exercices et logs.
7. Pour DB : migration versionnée, comparaison avec historique distant, smoke tests.

## État de production connu
- Render liftely-api, Free, Oregon, branche main, racine backend/.
- Build : pip install -r requirements.txt ; start : gunicorn --bind 0.0.0.0:$PORT app:app.
- Supabase liftely, PostgreSQL 17.11, eu-west-2.
- Catalogue 349 exercices (337 actifs). Les dix tables de comptes et d'entraînement sont vides au dernier contrôle.
- RLS actif sur 11 tables ; aucune policy ; aucun grant direct table/séquence aux rôles anon/authenticated.
- Health Check Path Render vide au dernier contrôle.
- Plan Supabase et rétention effective des backups à confirmer.

## Informations non incluses
Aucun mot de passe, token, clé, URI complète, certificat ou coordonnées bancaires. Identité juridique, identifiants permanents stores, projet EAS et propriété des comptes restent à confirmer par le propriétaire.
