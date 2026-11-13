# Sécurité et confidentialité

## Actifs et menaces
Actifs : comptes, e-mails, hash de mots de passe, jetons, historiques d'entraînement, base PostgreSQL, clés fournisseurs et sauvegardes. Menaces : prise de compte, accès horizontal IDOR/BOLA, fuite de secrets, erreurs de migration, dépendances compromises et sauvegardes/logs non chiffrés.

## Contrôles identifiés
- Hash mot de passe : Argon2id est utilisé pour les nouvelles inscriptions et réinitialisations (m=19 456 KiB, t=2, p=1). Les nouveaux mots de passe doivent contenir 15 à 256 caractères. Les hashes PBKDF2-HMAC-SHA256 historiques (200 000 tours) restent vérifiables et sont migrés automatiquement après une connexion réussie. La version de rollback PR #86 sait lire les deux formats. Ne jamais rollback vers une version antérieure à #86 après activation des écritures Argon2id.
- Hash SHA-256 des jetons d'action et de session persistés.
- Jetons d'action temporaires et à usage unique.
- Stockage mobile natif SecureStore ; stockage local Web à évaluer face au risque XSS.
- Rate limits login/e-mail avec tables dédiées.
- Vérification de propriété des séances/templates.
- Validation stricte des valeurs numériques et taille de requête limitée.
- CORS par allowlist, en-têtes HTTP de sécurité et HTTPS production.
- CI : cycle de vie compte, isolation, sécurité, PostgreSQL, lint, TypeScript et export.

## Supabase
RLS actif sur 11 tables. Aucun grant table/séquence direct à anon/authenticated au dernier contrôle, aucune fonction ni vue publique. Le client mobile ne doit pas accéder à la Data API. Le backend utilise LIFTELY_DATABASE_URL. Le signal rls_enabled_no_policy est informatif dans ce modèle : ne pas ajouter de policies permissives pour le supprimer. Une migration a aussi révoqué les privilèges Data API automatiques du rôle postgres pour les futures tables, séquences et fonctions du schéma public. Toute exposition future doit être explicitement accordée et accompagnée d'une politique adaptée.

## Dépendances et analyse statique
CodeQL analyse chaque semaine le code Python et JavaScript/TypeScript ; Dependabot vérifie mensuellement npm, pip et GitHub Actions et ouvre des propositions soumises à revue. Aucun auto-merge n'est activé. 

## Dépendances
Dernier audit après fusion de la PR #78 : **0 vulnérabilité npm** (0 low, 0 moderate, 0 high, 0 critical). Le dernier correctif ajoute un override `minimatch` vers 11.0.8, sans downgrade Expo SDK 57. La CI a validé npm ci, traductions, lint, TypeScript, Expo Doctor 21/21, export Web, intégration PostgreSQL et CodeQL. La PR #92 ajoute `pip-audit` à la CI pour auditer les dépendances Python backend ; son dernier résultat est `No known vulnerabilities found`. Continuer les audits à chaque release et ne pas utiliser `npm audit fix --force`.

## Données personnelles
Données : nom, e-mail, hash mot de passe, jetons, séances, charges, répétitions, templates et historique. Langue/thème locaux. Base Londres ; API Render Oregon ; e-mails via Brevo. La durée réelle de conservation des logs et backups n'est pas vérifiée. Vérifier le code avant d'annoncer publiquement les durées d'expiration.

## Avant commercialisation
À compléter avec le propriétaire/conseil : identité et adresse du responsable, contact, bases légales, finalités, durées par catégorie, contrats de sous-traitance, transferts internationaux, droits des personnes, politique de confidentialité, procédure d'effacement, déclarations Apple App Privacy et Google Play Data safety. Ce document est un inventaire technique, pas une certification RGPD ni un avis juridique.

## Secrets
Garder les secrets dans Render, GitHub Secrets et coffres fournisseurs. Rotation lors d'une cession. Jamais de DSN/clé dans un commit, issue ou variable EXPO_PUBLIC ; pas de jetons bruts dans les logs ni de dumps en clair dans un dépôt public.


Référence paramètres : [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
