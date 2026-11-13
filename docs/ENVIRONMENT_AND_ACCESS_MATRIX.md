# LIFTELY — matrice des variables, secrets et accès fournisseurs

**Révision : 13 novembre 2026**  
Ce document recense les noms de configuration, leur rôle et leur emplacement. Il ne contient aucune valeur secrète.

## 1. Variables mobile

| Nom | Usage | Sensibilité | État / règle |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | URL de l'API Flask incorporée au bundle | Publique, mais influence les données visées | `https://liftely-api.onrender.com` en production ; IP LAN en local |
 
**Important :** tout préfixe `EXPO_PUBLIC_` est embarqué dans le client. N'y mettre aucun mot de passe, clé privée, DSN ou token.

Fichier d'exemple : `mobile/.env.example`. Le fichier local réel doit rester ignoré par Git.

## 2. Variables backend / Render

| Nom | Usage | Sensibilité | Règle |
|---|---|---|---|
| `LIFTELY_DATABASE_URL` | DSN PostgreSQL canonique | **Critique** | Configurer uniquement dans Render ; ne jamais afficher/coller |
| `SUPABASE_DB_URL` | Ancien alias DSN reconnu par l'adaptateur | **Critique** | Compatibilité ; préférer le nom canonique |
| `DATABASE_URL` | Ancien alias DSN reconnu par l'adaptateur | **Critique** | Compatibilité ; préférer le nom canonique |
| `LIFTELY_DB_PATH` | Chemin SQLite local | Sensible opérationnel | Local/tests isolés ; pas de base de prod |
| `LIFTELY_CORS_ORIGINS` | Allowlist d'origines Web, séparées par virgules | Configuration publique | Vide par défaut ; n'ajouter que les origines contrôlées |
| `LIFTELY_PUBLIC_BASE_URL` | Origine HTTPS pour les liens d'action e-mail | Publique | Production : `https://liftely-api.onrender.com` |
| `LIFTELY_BREVO_API_KEY` | Authentification API transactionnelle Brevo | **Critique** | Secret Render ; rotation si fuite |
| `LIFTELY_EMAIL_FROM` | Adresse expéditeur validée | Donnée de compte | Doit correspondre à l'expéditeur/domaine autorisé Brevo |
| `LIFTELY_EMAIL_SENDER_NAME` | Nom affiché de l'expéditeur | Publique | Valeur par défaut LIFTELY |
| `LIFTELY_EMAIL_PROVIDER` | Fournisseur choisi / disclosure | Configuration | Doit refléter la configuration réelle |
| `LIFTELY_SMTP_HOST` | Hôte SMTP de secours | Configuration | À utiliser uniquement si fallback activé |
| `LIFTELY_SMTP_PORT` | Port SMTP | Configuration | 587 STARTTLS ou 465 SSL selon le serveur |
| `LIFTELY_SMTP_USERNAME` | Identifiant SMTP | Sensible | Secret d'accès |
| `LIFTELY_SMTP_PASSWORD` | Mot de passe SMTP | **Critique** | Secret Render |
| `LIFTELY_SMTP_USE_SSL` | Active SSL direct pour SMTP | Configuration | `true` pour le mode SSL direct |
| `LIFTELY_DATA_CONTROLLER` | Responsable du traitement | Donnée juridique | À fournir par le propriétaire |
| `LIFTELY_DATA_CONTROLLER_ADDRESS` | Adresse postale du responsable | Donnée juridique | À fournir, ne pas inventer |
| `LIFTELY_PRIVACY_CONTACT` | Contact confidentialité | Donnée juridique | À fournir |
| `LIFTELY_HOSTING_PROVIDER` | Hébergeur déclaré dans la page privacy | Publique | Render par défaut |
| `LIFTELY_HOSTING_REGION` | Région d'hébergement déclarée | Publique | Décrire distinctement Render Oregon et Supabase Londres |
| `LIFTELY_BACKUP_RETENTION` | Rétention réelle des sauvegardes | Donnée de conformité | À renseigner après vérification fournisseur |
| `LIFTELY_LOG_RETENTION` | Rétention réelle des logs | Donnée de conformité | À renseigner après vérification fournisseur |

Source de vérité des noms : `backend/.env.example`, `backend/app.py`, `backend/db_compat.py`.

## 3. Variables / secrets CI GitHub

Les workflows utilisent le `GITHUB_TOKEN` éphémère fourni par GitHub Actions avec des permissions déclarées au niveau du workflow. Les workflows PostgreSQL utilisent une base PostgreSQL de service éphémère. Les tests de production utilisent l'URL publique et ne nécessitent pas de DSN de production dans le workflow.

Le workflow `.github/workflows/supabase-backup.yml` attend deux secrets Actions au niveau du dépôt : `LIFTELY_DATABASE_URL` et `LIFTELY_BACKUP_PASSPHRASE` (au moins 32 caractères aléatoires). Tant qu'ils ne sont pas créés, le job s'arrête sans connexion ni export. Les artifacts sont chiffrés AES-256 et conservés 7 jours ; le dépôt étant public, les artifacts sont téléchargeables par les lecteurs, mais ne contiennent que le fichier chiffré. Conserver la passphrase dans un coffre indépendant et copier les archives hors site.

Ne pas ajouter de secret GitHub sans justification, permissions minimales et documentation. Le workflow historique `supabase-import.yml` peut contenir des références à des secrets de migration : ne pas le relancer sur la production sans revue du YAML et des conditions.

Aucun secret n'est reproduit dans ce document.

## 4. Fournisseurs et accès à transférer

| Fournisseur | Ressource | Ce que le repreneur doit obtenir | État |
|---|---|---|---|
| GitHub | `skandergat/app-musculation` | Admin du dépôt, Actions, Dependabot, CodeQL, collaborateurs, secrets, règles de branche | Dépôt public ; main non protégée au dernier contrôle |
| Render | Workspace `app`, service `liftely-api` | Accès workspace, service, variables, logs, deploys, facturation | Service Live ; Oregon ; Free |
| Supabase | Organisation/projet `liftely` | Owner/admin, DB, clés, logs, migrations, backups, facturation | PostgreSQL 17.11, eu-west-2 ; organisation Free (pas de backup quotidien automatique) |
| Brevo | Compte transactionnel | Owner/admin, expéditeur validé, domaine, API keys, logs et réputation | Probe sandbox API réussi ; livraison réelle non prouvée |
| Expo | Compte EAS | Organisation, projet, projectId, credentials, builds, secrets EAS | Pas de projectId lié identifié |
| Apple | Developer / App Store Connect | Titulaire, équipe, certificats, profils, accords, fiches store | Non confirmé |
| Google | Play Console | Titulaire, compte développeur, app signing, fiches store | Non confirmé |
| Domaine / DNS | Domaine public éventuel | Registrar, DNS, renouvellement, e-mails | Aucun domaine personnalisé identifié |

## 5. Procédure de rotation lors d'une cession

1. Ajouter le nouveau propriétaire comme administrateur nominatif sur chaque fournisseur.
2. Vérifier son accès et son moyen de récupération MFA.
3. Créer une nouvelle clé Brevo ; mettre à jour Render ; vérifier sandbox ; effectuer un test réel autorisé ; révoquer l'ancienne.
4. Changer le mot de passe / utilisateur PostgreSQL selon une procédure contrôlée ; mettre à jour Render ; tester /health ; révoquer l'ancien accès.
5. Revoir les clés Supabase et leur portée ; ne jamais mettre de secret service_role dans le mobile.
6. Revoir les collaborateurs GitHub, tokens personnels, deploy hooks, secrets Actions et rulesets.
7. Transférer l'organisation EAS et les credentials natifs selon les procédures Expo/Apple/Google.
8. Révoquer les anciens comptes après validation écrite du nouveau propriétaire.
9. Consigner date, fournisseur, responsable, résultat ; ne jamais consigner la valeur du secret.

## 6. Ce qui ne doit jamais être remis en clair

- URI PostgreSQL complète et mot de passe.
- Clé API Brevo.
- Clés Supabase secrètes / service_role.
- Tokens GitHub personnels, clés SSH, codes MFA ou codes de récupération.
- Certificats de signature et clés privées iOS/Android.
- Phrase secrète de chiffrement des sauvegardes dans le même canal que l'archive.
- Dump PostgreSQL non chiffré.
- Données personnelles exportées.

Utiliser un gestionnaire de mots de passe ou un coffre-fort d'équipe. Inviter le repreneur par son adresse nominative ; ne jamais envoyer les identifiants via une issue GitHub, un document public ou cette conversation.

## 7. Champs inconnus à confirmer

- Valeurs et présence exacte de toutes les variables Render (le connecteur ne permet pas de lire les valeurs ; ne pas les recopier ici).
- Plan Supabase et paramètres effectifs de sauvegarde.
- Rétention Render logs.
- Adresse expéditeur et validation SPF/DKIM/DMARC Brevo.
- Project ID EAS et identifiants iOS/Android.
- Titularité Apple/Google et domaine.
- Politique de MFA et procédures de récupération des comptes fournisseurs.
