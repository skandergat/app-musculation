# Réponse aux incidents et reprise après sinistre

## Principes
Préserver données et preuves, limiter l'impact, restaurer ensuite. Ne pas supprimer de ressource, purger la base ou lancer une migration improvisée sous pression.

## API Render indisponible
1. Vérifier statut Render, événements et dernier déploiement.
2. Lire logs build/app ; rechercher traceback, erreurs DB, mémoire et port.
3. Tester /health et /exercices.
4. Si le dernier déploiement est responsable, revenir au dernier déploiement applicatif sain.
5. Vérifier que le rollback n'a pas besoin d'une migration DB inverse : un rollback Render ne rollback pas PostgreSQL.
6. Documenter incident, durée, commit, cause et action préventive.

## Connexion PostgreSQL
Ne jamais publier la DSN. Vérifier présence de LIFTELY_DATABASE_URL dans Render, host/port/user/pooler et encodage du mot de passe dans le Dashboard. Corriger via canal sécurisé, redéployer et tester /health. Ne jamais basculer en SQLite pour masquer une panne.

## Fuite de secret
Identifier secret et systèmes concernés ; révoquer/rotater chez le fournisseur ; mettre à jour Render/GitHub Secrets ; redéployer si nécessaire ; vérifier les logs. Une clé committée est considérée compromise même après suppression de l'historique.

## Perte/corruption DB
1. Suspendre les écritures non essentielles.
2. Exporter l'état actuel si lisible.
3. Identifier le dernier backup vérifié et son heure.
4. Restaurer d'abord dans un environnement isolé.
5. Comparer schéma, compte de lignes, séquences, contraintes et smoke tests.
6. Obtenir accord du propriétaire avant restauration production.
7. Effectuer bascule et tester auth, séance, template, historique et suppression.

## E-mails non délivrés
Vérifier clé Brevo, expéditeur/domaine validé, SPF/DKIM/DMARC, crédits et logs. Ne pas relancer massivement. Sandbox valide la requête sans envoi ; test réel exige un destinataire autorisé. Ne jamais logger un jeton d'action.

## Contacts
Le contact incident et le responsable de traitement doivent être définis par le propriétaire avant commercialisation. Ne pas inventer de contact.
