# Checklist de transfert ou cession de LIFTELY

## Préparation
- [ ] Confirmer la propriété du code métier, des maquettes, du nom LIFTELY, du logo, des illustrations, des contenus et des domaines ; conserver les preuves de création/cession.
- [ ] Vérifier les licences des dépendances et des assets individuellement. Le fichier `mobile/LICENSE` contient la licence MIT d'Expo (copyright 650 Industries) et ne constitue pas une licence globale ni une preuve de propriété du code LIFTELY. Aucun fichier `LICENSE` à la racine n'a été identifié au dernier audit.
- [ ] Décider si le dépôt public doit devenir privé avant une négociation confidentielle ; un dépôt public a déjà rendu l'historique accessible.
- [ ] Dépôt à jour, release taguée, issues/PR exportées.
- [ ] Archive du code et des documents sans secrets.
- [ ] Export PostgreSQL chiffré et restauration vérifiée sur base isolée.
- [ ] Inventaire variables par nom/finalité/emplacement, sans valeurs.
- [ ] Licences des dépendances et assets vérifiées pour usage commercial.
- [ ] Comptes fournisseurs, abonnements, coûts, quotas et factures inventoriés.
- [ ] Bugs, dettes techniques et éléments non terminés documentés.
- [ ] Contrat de cession et droits IP examinés par professionnel si vente.

## Accès à transférer
- [ ] GitHub dépôt, organisation, Actions, secrets, protections.
- [ ] Render workspace/service, facturation, domaine, variables.
- [ ] Supabase organisation/projet, clés, facturation, backups.
- [ ] Brevo organisation, expéditeur, domaine, API keys.
- [ ] Expo/EAS organisation, projet et credentials.
- [ ] Apple Developer / App Store Connect.
- [ ] Google Play Console.
- [ ] DNS/domain registrar, monitoring, support, e-mail.

Inviter le nouveau propriétaire via les procédures officielles. Ne pas partager un compte personnel. Vérifier son accès puis transférer la propriété.

## Rotation
- [ ] Nouvelle clé Brevo, mise à jour Render, test, révocation ancienne clé.
- [ ] Rotation mot de passe PostgreSQL, mise à jour Render/GitHub secrets.
- [ ] Revue clés Supabase et révocation des clés inutilisées.
- [ ] Revue tokens GitHub, deploy hooks et collaborateurs.
- [ ] Rotation credentials EAS/App Store/Play selon besoin.
- [ ] Retrait des anciens accès.
- [ ] Journal daté des rotations.

## Livrables
Code source, tags, docs, export chiffré, procédure restauration testée, inventaire services/coûts, matrice variables sans secrets, architecture/endpoints/modèle données, décisions migration, confidentialité, backlog et PV de transfert des accès.

## État technique au 13 novembre 2026
- Supabase PostgreSQL 17.11 actif ; six migrations appliquées et versionnées. Aucun grant direct table/séquence/fonction pour `anon`, `authenticated` et `service_role`. Les default ACL de `postgres` sont révoqués pour les futurs objets. Limite : les default ACL du superuser plateforme `supabase_admin` restent gérées par Supabase ; aucun objet public applicatif existant n'est détenu par ce rôle (17 objets détenus par `postgres`).
- Smoke production post-politique mot de passe du 13 novembre vert (`43418126209`) : PostgreSQL, 337 exercices actifs, route privée 401, Brevo sandbox accepté sans livraison, page confidentialité noindex avec hébergeurs/régions exacts. Déploiement Render `dep-dbrfaoe1egvs73fon2sg` Live.
- Sécurité mobile/backend : `npm audit` à 0 vulnérabilité ; Expo Doctor 21/21, lint, TypeScript, traductions et export Web verts après PR #78. PR #86/#87/#96 activent Argon2id avec compatibilité PBKDF2 et migration transparente au login ; nouveaux mots de passe 15–256 caractères. PR #92 ajoute `pip-audit` à la CI ; résultat : `No known vulnerabilities found`.
- CodeQL hebdomadaire et Dependabot mensuel configurés ; aucune fusion automatique.
- EAS profiles development/preview/production présents ; expo-dev-client installé ; icône iOS LIFTELY corrigée.
- Scripts locaux fournis : backup Supabase chiffré (non exécuté) et reset SQLite copy-only (tests CI verts).
- Dépôt GitHub actuellement public ; aucune protection de branche main vérifiée/configurée.

## Points restant à fournir par le propriétaire
- Identité juridique et coordonnées responsable de traitement.
- Bundle ID iOS et package Android.
- Compte/projet EAS et comptes Apple/Google.
- Rétention réelle backups/logs.
- Exécuter le script de sauvegarde, copier l'archive chiffrée hors site et effectuer un test de restauration isolé.
- Test réel Brevo avec destinataire autorisé (sandbox API déjà validé, aucune livraison effectuée).
- Health Check Path Render.
- Maintenir les audits npm et pip-audit à chaque release ; les deux derniers rapports sont à zéro vulnérabilité connue.
- Évaluation déplacement Render Europe après mesures.

## Acceptation
Le repreneur doit : cloner et installer le mobile ; lancer l'API SQLite ; exécuter les tests ; restaurer le dump sur PostgreSQL isolé ; déployer une version de test ; vérifier auth, séance, template, historique et suppression ; expliquer le rollback et la rotation des secrets. Le transfert est accepté après ces étapes et contrôle de propriété des comptes.
