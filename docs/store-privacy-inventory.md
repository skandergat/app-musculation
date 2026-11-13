# LIFTELY — inventaire de confidentialité pour les stores

Cet inventaire reflète l'architecture contrôlée le 13 novembre 2026. Il doit être comparé aux paramètres finaux Render, Supabase, Brevo, logs et sauvegardes avant de remplir Apple App Privacy et Google Play Data safety.

## Données traitées

| Donnée | Finalité | Stockage / traitement |
| --- | --- | --- |
| Nom, adresse e-mail, date de création du compte | Création et gestion du compte, vérification d'adresse et récupération | Supabase PostgreSQL, schéma `public`, région `eu-west-2` (Londres) |
| Mot de passe | Authentification | Seul un hash PBKDF2-HMAC-SHA256 salé est stocké dans PostgreSQL |
| Jeton de session | Maintenir la connexion | Stockage sécurisé natif / stockage navigateur ; seul le hash SHA-256 est conservé par l'API |
| Jeton d'action e-mail | Vérification, réinitialisation, suppression du compte | Seul le hash SHA-256 est conservé par l'API ; le jeton brut est inclus dans un lien temporaire |
| Identifiants de limitation e-mail/IP | Réduire les abus automatisés | Identifiants hachés dans PostgreSQL, avec durée de conservation limitée par la logique applicative |
| Séances, exercices, charges, répétitions, dates et templates | Suivi d'entraînement, historique et progression | Supabase PostgreSQL, région `eu-west-2` |
| Langue et thème | Restaurer les préférences d'affichage | Stockage local de l'application/navigateur ; non transmis à l'API |

## Fournisseurs et régions

- **API :** Render, service `liftely-api`, région Oregon (États-Unis).
- **Base de données :** Supabase PostgreSQL 17.11, région `eu-west-2` (Londres).
- **E-mails transactionnels :** Brevo API via HTTPS. L'URL publique utilisée pour les liens d'action est `https://liftely-api.onrender.com`.
- **Logs :** Render conserve des journaux de service et de requêtes selon les paramètres du compte. La durée exacte doit être vérifiée dans le Dashboard.
- **Sauvegardes :** confirmer les paramètres de sauvegarde, la rétention et les procédures de restauration Supabase avant de déclarer une durée.
- Aucun SDK d'analytics ou de publicité n'a été identifié dans les dépendances mobiles examinées. Recontrôler si un fournisseur est ajouté.

Le service Render et la base Supabase sont dans des régions différentes. Cela peut augmenter la latence des requêtes, mais ne change pas la région de stockage de la base, qui est Londres.

## Cycle de vie des données

- Un nouveau compte n'est utilisable qu'après confirmation de l'adresse e-mail.
- Les comptes non vérifiés sont supprimés après 7 jours.
- Les liens de vérification expirent après 48 heures ; les liens de réinitialisation après 1 heure ; les liens de suppression après 24 heures. Chaque lien est à usage unique.
- Une réinitialisation de mot de passe révoque les sessions existantes.
- La confirmation de suppression du compte supprime le compte et ses données d'entraînement actives (séances, séries, templates, sessions et jetons d'action).
- La durée de conservation des sauvegardes et des journaux doit être confirmée dans les paramètres des fournisseurs avant publication.

## Points à compléter avant publication

- Identité juridique et adresse postale du responsable du traitement.
- Adresse de contact dédiée à la confidentialité.
- Nom exact du fournisseur d'e-mail et détails du traitement sous-traitant.
- Durée de rétention des journaux Render.
- Paramètres et durée de rétention des sauvegardes Supabase.
- Vérification de la page publique de confidentialité et de la page de suppression de compte.

Les formulaires de store doivent refléter les données effectivement traitées par l'application et ses fournisseurs. Ne pas déclarer une rétention précise tant qu'elle n'a pas été vérifiée.

## Liens et références

- Politique de confidentialité : `https://liftely-api.onrender.com/privacy`
- Page de suppression de compte : `https://liftely-api.onrender.com/account-deletion`
- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Render logging](https://render.com/docs/logging)
