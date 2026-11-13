# Builds EAS et publication mobile

## État
Expo SDK 57, Expo Router, schéma URL liftely://. Assets présents dans mobile/assets/images/ : icon.png, android-icon-foreground.png, android-icon-background.png, android-icon-monochrome.png, favicon.png et splash-icon.png. Les bundle IDs iOS/Android et l'identifiant projet EAS ne sont pas configurés. Ils sont permanents et doivent être choisis par le propriétaire.

## EAS
mobile/eas.json définit les profils development, preview et production, ainsi que submit.production. Le projet EAS doit encore être créé dans le compte qui appartiendra au propriétaire, puis lié via expo.extra.eas.projectId dans mobile/app.json.

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
