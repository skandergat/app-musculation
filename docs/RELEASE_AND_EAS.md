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
- Les tests CI PostgreSQL utilisent une base éphémère dédiée ; ils ne doivent jamais recevoir le DSN de production.
- Un backend staging accessible aux builds EAS preview reste à héberger. Une option gratuite Render peut être envisagée avec stockage éphémère et données synthétiques uniquement ; aucun service n'a été créé car le workspace Render doit être explicitement sélectionné et il faut confirmer les limites gratuites avant activation.

Le profil preview ne devient utilisable sur appareil qu'après déploiement du backend de staging, définition de l'URL EAS preview et test de non-régression.

## URL API des builds

Le profil production utilise `https://liftely-api.onrender.com`. Le profil preview est maintenant isolé et protégé contre un repli silencieux sur la production. Le profil development conserve son fallback réseau local.
