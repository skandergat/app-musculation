# Checklist de transfert ou cession de LIFTELY

## Préparation
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

## Points restant à fournir par le propriétaire
- Identité juridique et coordonnées responsable de traitement.
- Bundle ID iOS et package Android.
- Compte/projet EAS et comptes Apple/Google.
- Rétention réelle backups/logs.
- Sauvegarde hors site et test de restauration.
- Test réel Brevo avec destinataire autorisé.
- Health Check Path Render.
- Correctifs npm/Expo à valider.
- Évaluation déplacement Render Europe après mesures.

## Acceptation
Le repreneur doit : cloner et installer le mobile ; lancer l'API SQLite ; exécuter les tests ; restaurer le dump sur PostgreSQL isolé ; déployer une version de test ; vérifier auth, séance, template, historique et suppression ; expliquer le rollback et la rotation des secrets. Le transfert est accepté après ces étapes et contrôle de propriété des comptes.
