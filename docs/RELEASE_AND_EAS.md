# Builds EAS et publication mobile

## État
Expo SDK 57, Expo Router, schéma URL liftely://. Assets présents dans mobile/assets/images/ : icon.png, android-icon-foreground.png, android-icon-background.png, android-icon-monochrome.png, favicon.png et splash-icon.png. Les bundle IDs iOS/Android et l'identifiant projet EAS ne sont pas configurés. Ils sont permanents et doivent être choisis par le propriétaire.

## EAS
mobile/eas.json définit les profils development, preview et production, ainsi que submit.production. Le paquet expo-dev-client est installé pour le profil development. Le projet EAS doit encore être créé dans le compte qui appartiendra au propriétaire, puis lié via expo.extra.eas.projectId dans mobile/app.json.

Ne pas lancer de build avant :
- vérification de disponibilité et choix de ios.bundleIdentifier et android.package ;
- création/lien du projet EAS ;
- comptes Apple/Google et credentials confirmés ;
- privacy et pages publiques finalisées.

## Identifiants
Choisir un reverse-DNS stable, par exemple com.organisation.liftely, uniquement après vérification et confirmation de propriété. Ne pas utiliser une valeur exemple. Changer l'identifiant après publication peut empêcher la mise à jour d'une app existante.

## Commandes
Depuis mobile/ :
~~~powershell
npm ci
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest project:init
npx.cmd eas-cli@latest config
npx.cmd expo-doctor
~~~

Builds :
~~~powershell
npx.cmd eas-cli@latest build --profile development --platform android
npx.cmd eas-cli@latest build --profile preview --platform all
npx.cmd eas-cli@latest build --profile production --platform all
~~~

Soumission :
~~~powershell
npx.cmd eas-cli@latest submit --profile production --platform android
npx.cmd eas-cli@latest submit --profile production --platform ios
~~~

Vérifier les quotas et coûts EAS avant de lancer les builds. Les frais Apple Developer et Google Play sont distincts du budget de développement.

## Checklist
- [ ] CI et tests PostgreSQL verts
- [ ] Version/build number à jour
- [ ] Bundle IDs confirmés et disponibles
- [ ] EAS project ID lié au compte propriétaire
- [ ] Icônes/splash validés sur appareils
- [ ] Permissions natives minimales
- [ ] Deep links et liens e-mail testés
- [ ] Privacy et suppression de compte publiées
- [ ] App Privacy / Data safety renseignés
- [ ] Preview testée iOS et Android
- [ ] Rollback et monitoring prêts

## Séparation API preview / production

Les profils EAS ne doivent jamais partager implicitement leur backend :
- `development` utilise le backend local ou une URL de développement explicite.
- `preview` utilise l'environnement EAS `preview` et exige une variable `EXPO_PUBLIC_API_URL` configurée vers un backend de staging dédié.
- `production` utilise l'URL API de production.

Le profil `preview` ne contient volontairement plus l'URL Render de production. Le module `mobile/src/config/api.ts` échoue maintenant de façon explicite si une preview n'a pas d'URL dédiée ou si cette URL pointe vers `liftely-api.onrender.com`. Cela évite qu'une build de test touche la base de production par erreur.

**Conséquence assumée :** tant que le backend de staging n'est pas créé et que `EXPO_PUBLIC_API_URL` n'est pas définie dans l'environnement EAS `preview`, la build preview doit échouer plutôt que d'utiliser la production. Ne pas contourner ce garde-fou.

## Staging sans coût récurrent

- Une branche Supabase payante à l'heure n'est pas retenue : le tarif vérifié est de 0,01344 USD/heure (environ 9,80 USD sur 30 jours si elle reste active).
- Le projet Supabase de production ne doit pas être cloné ni modifié pour les tests.
- Le backend prend en charge SQLite via `LIFTELY_DB_PATH` lorsque `LIFTELY_DATABASE_URL`, `SUPABASE_DB_URL` et `DATABASE_URL` sont absentes. Une copie locale de la base de test et des données synthétiques peuvent donc servir aux tests développeur sans credentials de production.

### Démarrer un backend local isolé sous Windows / PowerShell

Depuis la racine du dépôt, créer une base staging déterministe depuis le fixture public assaini (349 exercices, aucun compte ni historique) :

~~~powershell
python scripts/create_liftely_staging_sqlite.py --output "$env:USERPROFILE\LIFTELY-Backups\staging\liftely-staging.sqlite"
~~~

Le script vérifie l'intégrité SQLite, les clés étrangères et le nombre exact de lignes. Il refuse d'écraser un fichier existant et refuse de créer le fichier à l'intérieur du dépôt.

Pour initialiser un **nouveau projet PostgreSQL staging uniquement**, définir localement `LIFTELY_DATABASE_URL` avec le DSN du projet staging (jamais celui de production), puis exécuter :

~~~powershell
python backend\migrate_sqlite_to_postgres.py --source "$env:USERPROFILE\LIFTELY-Backups\staging\liftely-staging.sqlite" --create-schema
~~~

L'importeur lit la source SQLite en lecture seule, refuse les données cibles existantes non identiques et réalise l'import dans une transaction. Retirer ensuite le DSN de l'environnement PowerShell.

Dans un terminal PowerShell dédié, lancer le backend exclusivement sur cette copie :

~~~powershell
$env:LIFTELY_DB_PATH = "$env:USERPROFILE\LIFTELY-Backups\staging\liftely-staging.sqlite"
Remove-Item Env:LIFTELY_DATABASE_URL,Env:SUPABASE_DB_URL,Env:DATABASE_URL -ErrorAction SilentlyContinue
python backend\app.py
~~~

Dans un second terminal, depuis `mobile\`, lancer Expo en développement local (ne pas créer de build EAS Preview tant que le backend distant de staging n'existe pas) :

~~~powershell
$env:EXPO_PUBLIC_APP_ENV = "development"
$env:EXPO_PUBLIC_API_URL = ""
npx.cmd expo start --lan
~~~

Le téléphone et le PC doivent être sur le même réseau Wi-Fi. Vérifier que le journal du backend indique SQLite, et non PostgreSQL. Ne jamais définir de DSN Supabase de production dans ces terminaux.
- Les tests CI PostgreSQL utilisent une base éphémère dédiée ; ils ne doivent jamais recevoir le DSN de production.
- Un backend staging accessible aux builds EAS preview reste à héberger. Une option gratuite Render peut être envisagée avec stockage éphémère et données synthétiques uniquement ; aucun service n'a été créé car le workspace Render doit être explicitement sélectionné et il faut confirmer les limites gratuites avant activation.

Le profil preview ne devient utilisable sur appareil qu'après déploiement du backend de staging, définition de l'URL EAS preview et test de non-régression.

## URL API des builds

Le profil production utilise `https://liftely-api.onrender.com`. Le profil preview est maintenant isolé et protégé contre un repli silencieux sur la production. Le profil development conserve son fallback réseau local.
