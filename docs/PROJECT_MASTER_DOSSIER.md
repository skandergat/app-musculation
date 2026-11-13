# LIFTELY — dossier maître produit, technique et opérationnel

**Révision : 13 novembre 2026**  
**Dépôt :** https://github.com/skandergat/app-musculation  
**Branche de référence :** `main`  
**Statut :** MVP fonctionnel en développement avancé ; API de production connectée à PostgreSQL ; publication stores non configurée.

> Ce dossier est la porte d'entrée pour un développeur, une agence, un repreneur ou un acquéreur technique. Il décrit ce qui existe, ce qui a été vérifié, les chemins de code et les points qui restent à faire. Les valeurs inconnues sont signalées comme inconnues : elles ne doivent pas être inventées.

## 1. Résumé exécutif

LIFTELY est une application de suivi de musculation et de calisthenics. Le mobile est développé avec Expo / React Native / TypeScript. Il communique avec une API Flask en HTTPS. L'API utilise une base Supabase PostgreSQL en production et SQLite en développement local. Les e-mails transactionnels passent par Brevo (API HTTPS), avec SMTP TLS en solution de repli.

### État vérifié

| Élément | État |
|---|---|
| Dépôt GitHub | Public, `skandergat/app-musculation` |
| Branche principale | `main` |
| API Render | `liftely-api`, Live, plan Free, Oregon |
| Base de production | Supabase `liftely`, PostgreSQL 17.11, Londres (`eu-west-2`), organisation Free |
| Connexion API → PostgreSQL | Confirmée ; `GET /health` retourne le moteur utilisé |
| Catalogue | 349 exercices, 337 actifs |
| Comptes et historiques en base | Tables présentes mais vides au dernier contrôle |
| E-mails | API Brevo sandbox vérifiée ; aucun e-mail réel livré pendant l'audit |
| CI | GitHub Actions : backend, mobile, PostgreSQL isolé, CodeQL, smoke production |
| EAS | `mobile/eas.json` présent ; projet EAS et identifiants stores non liés |
| Builds stores | Aucune build de production validée à ce jour |
| Politique de confidentialité | Page publiée comme brouillon non indexable ; champs juridiques à compléter |
| Sauvegarde | Script manuel chiffré présent ; sauvegarde et restauration réelles non encore prouvées |

### Décisions structurantes

- Le mobile ne se connecte pas directement à Supabase Data API. Les opérations métier passent par l'API Flask.
- L'authentification est implémentée dans Flask ; ce n'est pas Supabase Auth.
- Le catalogue d'exercices est partagé ; comptes, séances, séries, sessions et templates sont privés.
- Les tests et imports doivent utiliser SQLite local ou PostgreSQL isolé. La production ne doit pas être utilisée pour des tests destructifs.
- La fixture d'import assainie ne contenait que le catalogue ; les anciennes bases SQLite personnelles ne doivent pas être fusionnées sans projet de réconciliation dédié.

## 2. Architecture générale

```text
iOS / Android / Web
       |
       | Expo Router + React Native + TypeScript
       | HTTPS + Authorization: Bearer <session-token>
       v
Render — liftely-api (Flask + Gunicorn, Oregon)
       |
       | LIFTELY_DATABASE_URL (secret Render)
       v
Supabase PostgreSQL 17.11 (eu-west-2, Londres)

Flask -- HTTPS API transactionnelle --> Brevo
GitHub Actions --> tests, lint, TypeScript, Expo Doctor,
                   export Web, PostgreSQL isolé, CodeQL,
                   smoke test de production
```

### Conséquences opérationnelles

1. Une panne Render ne signifie pas nécessairement une panne Supabase.
2. Un rollback Render ne restaure pas la base.
3. Render est en Oregon alors que Supabase est à Londres : le trafic SQL traverse les régions. Mesurer la latence avant de déplacer l'API.
4. Le service Render est sur Free ; les périodes de veille/suspension et limites de ressources doivent être prises en compte.
5. Le dépôt étant public, aucune donnée confidentielle, export, DSN ou clé ne doit y être stocké.

## 3. Technologies et versions

| Couche | Technologie vérifiée |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6 |
| Navigation | Expo Router |
| Sécurité stockage mobile | Expo SecureStore sur natif ; stockage Web distinct |
| API | Python 3.12 en CI, Flask 3, Gunicorn |
| PostgreSQL | psycopg 3 |
| Base production | Supabase PostgreSQL 17.11 |
| Base locale | SQLite |
| E-mail | Brevo Transactional API HTTPS ; SMTP TLS fallback |
| CI/CD | GitHub Actions + Render auto-deploy sur `main` |
| Analyse statique | CodeQL (Python et JavaScript/TypeScript) |
| Dépendances | Dependabot |

Les versions exactes et plages sont dans `mobile/package.json`, `mobile/package-lock.json` et `backend/requirements.txt`. Ne pas modifier manuellement le lockfile sans réexécuter `npm ci` et la CI.

## 4. Cartographie du dépôt

### Racine

| Chemin | Rôle |
|---|---|
| `README.md` | Portail de reprise |
| `CONTRIBUTING.md` | Règles de contribution, tests et PR |
| `SECURITY.md` | Signalement des vulnérabilités |
| `.github/dependabot.yml` | Mises à jour automatisées |
| `.github/workflows/` | CI, sécurité, smoke et maintenance |
| `.vscode/` | Tâches et aide VS Code |
| `docs/` | Documentation produit, architecture, exploitation, transfert |
| `backend/` | API, schéma, migration et tests Python |
| `mobile/` | Application Expo |
| `supabase/migrations/` | Historique SQL versionné |
| `scripts/` | Sauvegarde et utilitaires de maintenance |
| `merge_sqlite_for_migration.py`, `init_db.py` | Scripts historiques ; lire leur code avant toute exécution |
| `requirements.txt` racine | Ancienne liste Flask seule ; le service Render utilise `backend/requirements.txt` (Flask, Gunicorn, psycopg) |

### Mobile — chemins clés

| Chemin | Responsabilité |
|---|---|
| `mobile/src/app/_layout.tsx` | Providers globaux et navigation racine |
| `mobile/src/app/(auth)/connexion.tsx` | Connexion |
| `mobile/src/app/(auth)/inscription.tsx` | Inscription |
| `mobile/src/app/(auth)/mot-de-passe-oublie.tsx` | Récupération |
| `mobile/src/app/(app)/index.tsx` | Accueil / catalogue |
| `mobile/src/app/(app)/seance.tsx` | Séance active |
| `mobile/src/app/(app)/historique.tsx` | Historique |
| `mobile/src/app/(app)/progression.tsx` | Progression |
| `mobile/src/app/(app)/templates.tsx` | Modèles d'entraînement |
| `mobile/src/app/(app)/profil.tsx` | Profil |
| `mobile/src/app/(app)/parametres.tsx` | Paramètres |
| `mobile/src/context/AuthContext.tsx` | État de session, login, inscription, logout, suppression |
| `mobile/src/context/I18nContext.tsx` | Traductions FR / EN / DE / AR |
| `mobile/src/context/ColorSchemeContext.tsx` | Thème clair/sombre |
| `mobile/src/config/api.ts` | URL API, timeout, fetch |
| `mobile/src/constants/theme.ts` | Tokens de design |
| `mobile/assets/images/` | Icônes, splash, illustrations et assets |

Le routage est fondé sur les fichiers Expo Router. Les groupes `(auth)` et `(app)` organisent les écrans ; les parenthèses ne font pas partie des URL publiques.

### Backend — chemins clés

| Chemin | Responsabilité |
|---|---|
| `backend/app.py` | API Flask monolithique : routes, authentification, logique métier, e-mails et pages publiques |
| `backend/db_compat.py` | Sélection SQLite/PostgreSQL et adaptateur SQL |
| `backend/postgres_schema.sql` | Schéma PostgreSQL de référence pour environnement vide |
| `backend/migration_preflight.py` | Préflight de migration |
| `backend/migrate_sqlite_to_postgres.py` | Import transactionnel contrôlé |
| `backend/postgres_integration_smoke.py` | Vérification PostgreSQL |
| `backend/account_lifecycle_smoke.py` | Parcours complet du compte |
| `backend/account_isolation_smoke.py` | Isolation entre utilisateurs |
| `backend/security_smoke.py` | Tests de sécurité |
| `backend/templates/privacy.html` | Page confidentialité |
| `backend/templates/account_deletion.html` | Page suppression de compte |
| `backend/static/` | CSS et JavaScript des pages d'action e-mail |

### Documentation à lire dans l'ordre

1. Ce dossier.
2. `docs/DEVELOPER_HANDOVER.md`.
3. `docs/ARCHITECTURE.md`.
4. `docs/DATA_MODEL.md`.
5. `docs/ENVIRONMENT_AND_ACCESS_MATRIX.md`.
6. `docs/OPERATIONS_RUNBOOK.md`.
7. `docs/SECURITY_AND_PRIVACY.md`.
8. `docs/INCIDENT_RESPONSE.md`.
9. `docs/RELEASE_AND_EAS.md`.
10. `docs/OWNERSHIP_TRANSFER.md`.
11. `backend/POSTGRES_MIGRATION.md`.

## 5. Fonctionnalités produit présentes

- Création de compte, vérification d'adresse e-mail, connexion et déconnexion.
- Demande et exécution de réinitialisation de mot de passe.
- Demande et confirmation de suppression de compte.
- Catalogue d'exercices : Gym et Calisthenics.
- Création, reprise, annulation et clôture d'une séance.
- Ajout, suppression et réorganisation d'exercices dans une séance.
- Ajout, modification et suppression de séries (charge / répétitions).
- Templates : CRUD, exercices, réorganisation et démarrage d'une séance à partir d'un template.
- Historique des séances et progression par exercice.
- Profil et paramètres.
- Langues FR, EN, DE et AR ; thème clair/sombre.

Le timer n'est pas une fonctionnalité à réintroduire sans nouvelle décision produit. Les paiements, abonnements, paywall, analytics commerciaux, offres premium et partenariats ne sont pas identifiés comme intégrés dans le code audité : les considérer comme backlog, pas comme fonctionnalités livrées.

## 6. API HTTP — inventaire des routes

La spécification de fait est dans les décorateurs et validations de `backend/app.py`. Aucun contrat OpenAPI généré n'a été identifié.

### Santé et pages publiques

| Méthode | Route | Usage |
|---|---|---|
| GET | `/health` | Test DB et informations non sensibles sur moteur / configuration e-mail |
| POST | `/health/brevo-sandbox` | Probe Brevo sandbox ; ne livre pas d'e-mail |
| GET | `/privacy` | Page de confidentialité |
| GET | `/account-deletion` | Page publique suppression de compte |
| GET | `/email/verify` | Interface de confirmation |
| GET | `/email/reset-password` | Interface de réinitialisation |
| GET | `/email/delete-account` | Interface de confirmation de suppression |

### Authentification

| Méthode | Route |
|---|---|
| POST | `/auth/register` |
| POST | `/auth/verify-email-request` |
| POST | `/auth/verify-email` |
| POST | `/auth/login` |
| POST | `/auth/password-reset-request` |
| POST | `/auth/password-reset` |
| GET | `/auth/me` |
| POST | `/auth/logout` |
| POST | `/auth/account-deletion-request` |
| POST | `/auth/account-delete-confirm` |
| DELETE | `/auth/account` |

### Catalogue, séances et progression

| Méthode | Route |
|---|---|
| GET | `/exercices` |
| POST | `/seances` |
| GET | `/seances/active` |
| POST | `/seances/{seance_id}/exercices` |
| PUT | `/seances/{seance_id}/exercices/reorder` |
| DELETE | `/seances/{seance_id}/exercices/{exercice_id}` |
| POST | `/seances/{seance_id}/series` |
| PUT | `/seances/{seance_id}/series/{series_id}` |
| DELETE | `/seances/{seance_id}/series/{series_id}` |
| POST | `/seances/{seance_id}/annuler` |
| POST | `/seances/{seance_id}/terminer` |
| GET | `/exercices/{exercice_id}/previous` |
| GET | `/historique` |
| GET | `/progression` |

### Templates

| Méthode | Route |
|---|---|
| GET / POST | `/templates` |
| GET / PUT / DELETE | `/templates/{template_id}` |
| POST | `/templates/{template_id}/exercices` |
| DELETE | `/templates/{template_id}/exercices/{exercice_id}` |
| PUT | `/templates/{template_id}/exercices/reorder` |
| POST | `/templates/{template_id}/start` |

Toutes les routes privées doivent obtenir l'utilisateur depuis le Bearer token puis filtrer les données par propriétaire. Une route qui se contente d'utiliser l'ID transmis par le client introduirait un risque IDOR/BOLA.

## 7. Authentification et sécurité des données

- Authentification applicative maison dans Flask ; pas Supabase Auth.
- Mots de passe hachés avec PBKDF2-HMAC-SHA256, sel aléatoire de 16 octets et 600 000 itérations ; les anciens hashes 200 000 itérations sont vérifiés puis réhachés au prochain login réussi.
- Jetons de session et jetons d'action persistés sous forme de hash SHA-256.
- Durée de session : 30 jours.
- Vérification e-mail : lien 48 h.
- Réinitialisation mot de passe : lien 1 h.
- Suppression compte : lien 24 h.
- Comptes non vérifiés : nettoyage après 7 jours.
- Les jetons d'action sont à usage unique.
- Expo SecureStore pour le jeton sur natif ; stockage Web à évaluer selon le modèle de menace XSS.
- Limitation de tentatives login et demandes e-mail avec tables dédiées.
- Limite de corps HTTP : 16 KiB.
- CORS fermé par défaut ; origines Web autorisées par `LIFTELY_CORS_ORIGINS`.
- En-têtes de sécurité : nosniff, frame deny, referrer policy, permissions policy, CSP ; HSTS quand HTTPS est reconnu derrière le proxy.
- Les routes de ressources privées doivent toujours contrôler le propriétaire.

Ce dossier n'est pas une certification de sécurité. Une revue indépendante de l'authentification maison, de la gestion des sessions, du stockage Web et des scénarios de récupération reste recommandée avant commercialisation.

## 8. Modèle de données et état de production

Tables applicatives :

| Table | Rôle |
|---|---|
| `users` | Comptes, e-mail, hash de mot de passe |
| `exercices` | Catalogue partagé |
| `sessions` | Sessions d'authentification (hash de jeton) |
| `auth_action_tokens` | Vérification, reset, suppression |
| `auth_mail_limits` | Limitation demandes e-mail |
| `auth_login_limits` | Limitation tentatives login |
| `seances` | Séances et propriétaire |
| `series` | Charges / répétitions |
| `seance_exercices` | Composition et ordre d'une séance |
| `templates` | Templates par utilisateur |
| `template_exercices` | Exercices et paramètres d'un template |

État relevé : `exercices` = 349 lignes (337 actives : 185 gym, 152 calisthenics ; 12 inactives). Les dix autres tables étaient vides au dernier contrôle. Les données de production peuvent évoluer ; refaire les COUNT avant une opération de maintenance.

### Sécurité Supabase

- RLS activé sur les 11 tables.
- Aucune policy RLS.
- Pas de privilège table/séquence direct pour `anon` et `authenticated` au dernier contrôle.
- Privilèges par défaut du rôle `postgres` révoqués pour les rôles Data API sur les futurs objets publics.
- Le backend utilise une connexion privilégiée ; le client mobile ne doit pas accéder directement aux tables.
- Le signal Supabase `rls_enabled_no_policy` est informatif dans ce modèle précis ; ne pas créer de policy permissive pour le faire disparaître.
- Toute exposition directe future nécessite une décision d'architecture, des GRANT explicites et des policies adaptées.

### Migrations versionnées

Voir `supabase/migrations/` et `backend/POSTGRES_MIGRATION.md`. Les versions présentes sont :
- `20261112205509_enable_rls_auth_login_limits.sql`
- `20261112212316_reconcile_auth_login_limits_table.sql`
- `20261113094009_harden_public_schema_and_index_foreign_keys.sql`
- `20261113100533_revoke_public_default_privileges.sql`
- `20261113102246_revoke_remaining_public_default_privileges.sql`

Ne pas réappliquer une migration déjà présente dans l'historique distant. Ne jamais relancer le workflow d'import initial sur la base de production déjà initialisée.

## 9. Variables et accès

La matrice exhaustive des noms, finalités, emplacement, sensibilité et état est dans `docs/ENVIRONMENT_AND_ACCESS_MATRIX.md`.

Règles :
- `LIFTELY_DATABASE_URL` : secret critique, variable canonique Render.
- `LIFTELY_BREVO_API_KEY` : secret critique, variable Render.
- `LIFTELY_PUBLIC_BASE_URL` : URL publique, pas un secret.
- `EXPO_PUBLIC_API_URL` : variable embarquée dans l'app ; jamais y mettre un secret.
- Ne jamais écrire les valeurs dans un document, issue, commit, capture d'écran ou message.
- Ne jamais mettre une clé Supabase service_role dans le mobile.
- L'accès à GitHub, Render, Supabase, Brevo et Expo se transfère par invitations nominatives et rôles minimaux, jamais par partage d'un compte personnel.

## 10. Développement local reproductible

### Prérequis

- Git.
- Node.js 22 LTS (version CI) et npm.
- Python 3.12 (version CI).
- PowerShell sur Windows.
- Pour PostgreSQL local : PostgreSQL 16+ pour CI/tests, et PostgreSQL 17+ pour dumps de la production PostgreSQL 17.
- Pour le script de sauvegarde Windows : `pg_dump`, `pg_restore`, 7-Zip.

### Cloner et lancer le mobile

```powershell
git clone https://github.com/skandergat/app-musculation.git
cd app-musculation
cd mobile
npm ci
npx.cmd expo start --clear
```

Pour le téléphone sur réseau local, l'adresse du PC doit être joignable ; si nécessaire :
```powershell
npx.cmd expo start --clear --tunnel
```

Contrôles :
```powershell
npm.cmd run check:translations
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor
npx.cmd expo export --platform web
```

### Lancer l'API locale

Depuis la racine :
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe .\backend\app.py
```

L'API écoute sur le port 5001. Sans DSN PostgreSQL, le backend utilise `backend/musculation.db` (ou `LIFTELY_DB_PATH`). Pour un téléphone, utiliser l'IP LAN du PC, pas `localhost`.

### Environnement mobile

Copier `mobile/.env.example` vers un fichier local non versionné et régler :
```dotenv
EXPO_PUBLIC_API_URL=http://<IP-LAN-DU-PC>:5001
```

Pour l'API hébergée :
```dotenv
EXPO_PUBLIC_API_URL=https://liftely-api.onrender.com
```

Attention : le bundle pointant vers la production modifie les vraies données. Les tests de parcours doivent utiliser une API et une base isolées.

## 11. CI/CD et qualité

Workflows actuels :
- `.github/workflows/ci.yml` : Python, tests backend, reset-copy, script PowerShell, lifecycle/isolation/security, npm ci, traductions, audit, ESLint, TypeScript, export Web, Expo Doctor.
- `.github/workflows/postgres-integration.yml` : PostgreSQL éphémère, schéma, adaptateur, import, rollback, cycle de vie.
- `.github/workflows/production-smoke.yml` : vérifications de production quotidiennes ; /health, Brevo sandbox sans livraison, page confidentialité, catalogue et route privée anonyme.
- `.github/workflows/codeql.yml` : analyse Python et JavaScript/TypeScript, planifiée.
- `.github/workflows/mobile-dependency-maintenance.yml` : candidat de mise à jour mensuel, tests, sans fusion automatique.
- `.github/workflows/supabase-import.yml` : workflow historique d'import contrôlé ; ne pas exécuter à nouveau sur production.

Au dernier audit CI, les tests backend, le lint, le typecheck, l'export Web et Expo Doctor 21/21 passaient. Le dernier audit npm montrait 10 vulnérabilités modérées, 0 high, 0 critical et 0 low ; les correctifs automatiques restants proposés par npm impliquent notamment un downgrade majeur Expo vers SDK 52. Ne pas utiliser `npm audit fix --force`. Vérifier le résultat d'un nouveau run avant d'affirmer que le nombre a changé.

## 12. Déploiement et exploitation

### Render

- Workspace : `app`.
- Service : `liftely-api`.
- URL : https://liftely-api.onrender.com
- Branche : `main`.
- Racine : `backend/`.
- Build : `pip install -r requirements.txt`.
- Start : `gunicorn --bind 0.0.0.0:$PORT app:app`.
- Auto-deploy : activé sur commit.
- Plan : Free.
- Région : Oregon.
- Health Check Path : vide au dernier contrôle ; à configurer manuellement sur `/health` dans Render Dashboard > service > Settings > Health & Checks. Le connecteur d'administration utilisé pendant l'audit ne permet pas de modifier ce champ.

### Supabase

- Projet : `liftely`.
- Région : `eu-west-2`.
- PostgreSQL : 17.11.
- Tables applicatives : 11.
- Migrations : 5 au dernier contrôle.
- Organisation Supabase : plan Free confirmé. Pas de sauvegarde quotidienne automatique incluse ; prévoir export chiffré régulier et copie hors site.

### Brevo

- Fournisseur prévu : Brevo Transactional API HTTPS.
- `POST /health/brevo-sandbox` a été vérifié avec succès via GitHub Actions. Ce probe utilise `X-Sib-Sandbox: drop` et une adresse invalide réservée ; il valide la clé et le payload sans livrer de message.
- La délivrabilité réelle (expéditeur validé, SPF/DKIM/DMARC, réception) n'est pas prouvée. Aucun mail réel n'a été envoyé pendant cet audit.

### Sauvegardes

Le script `scripts/backup-supabase.ps1` réalise un dump custom PostgreSQL, vérifie sa lisibilité, chiffre une archive 7z AES-256 avec noms chiffrés, puis supprime le dump temporaire. Il requiert PostgreSQL client 17+ et 7-Zip. Il refuse d'écrire dans le dépôt Git.

Le script n'a pas été exécuté ici et aucune restauration n'a été testée. L'organisation Supabase est sur le plan Free : pas de sauvegarde quotidienne automatique incluse. Les plans Pro/Team/Enterprise bénéficient de sauvegardes quotidiennes selon la politique Supabase. Le script manuel doit être exécuté régulièrement et une copie chiffrée hors site doit être conservée. Prévoir une copie chiffrée hors site et un exercice de restauration.

## 13. Publication iOS / Android

- `mobile/eas.json` existe et définit development, preview et production.
- `expo-dev-client` est installé.
- `mobile/app.json` a le nom, slug, scheme, icônes, splash, plugins et web output.
- Les champs `ios.bundleIdentifier`, `android.package` et `extra.eas.projectId` ne sont pas renseignés.
- Le projet EAS doit être créé/lié au compte qui conservera la propriété de l'app.
- Les comptes Apple Developer et Google Play Console, les certificats et clés de signature doivent être fournis par le propriétaire.
- Aucun build de production ni soumission store n'est attesté.

Ces identifiants sont pérennes et peuvent être difficiles à changer après publication. Ne pas les inventer pour faire passer Expo Doctor.

## 14. Risques et dette technique connus

| Priorité | Sujet | Conséquence / action |
|---|---|---|
| P0 avant mise en production publique | Identité juridique, contact et politique confidentialité complète | Obligatoire pour déclarations et transparence |
| P0 avant store | Bundle IDs, EAS project, comptes Apple/Google, builds natifs | Nécessite le propriétaire des comptes |
| P1 | Sauvegarde chiffrée hors site et restauration testée | Réduire le risque de perte de données |
| P1 | Health Check Path Render = `/health` | Configuration Dashboard manuelle |
| P1 | Revue sécurité indépendante de l'authentification maison | Réduire risques auth/session/IDOR |
| P1 | 10 vulnérabilités npm modérées au dernier audit ; aucune high/critical | Résoudre sans downgrade SDK |
| P1 | Branch `main` non protégée au dernier contrôle | Activer ruleset/required checks et revue PR |
| P2 | Render Oregon ↔ Supabase Londres | Mesurer latence ; migration région seulement avec plan de bascule |
| P2 | Test de livraison Brevo réel | Nécessite destinataire autorisé et domaine expéditeur vérifié |
| P2 | Réduire le monolithe `backend/app.py` | Modulariser par domaine sans casser les tests |
| P2 | Spécification OpenAPI absente | Formaliser contrat API et schémas |
| P1 avant vente/cession | Droits de propriété intellectuelle à clarifier | Aucun LICENSE racine ; `mobile/LICENSE` est le texte MIT d'Expo (copyright 650 Industries), pas une preuve de cession des droits LIFTELY. Vérifier auteur, contrats, assets, marques et licences de dépendances. |
| P2 | Revue des licences et droits des assets | Nécessaire avant cession commerciale |

## 15. Règles de changement et rollback

- Toute modification passe par une branche et une PR.
- Ne pas pousser directement sur `main`.
- Attendre CI backend/mobile/PostgreSQL et revue.
- Changement DB : migration versionnée, vérifier historique distant, appliquer une fois, postflight et tests.
- Ne pas lancer `supabase-import.yml` sur la production initialisée.
- Avant migration destructive : sauvegarde vérifiée, restauration testée, plan de retour arrière et approbation.
- Rollback Render : restaure le code/API, pas les données PostgreSQL.
- Si un secret fuit : considérer compromis, le révoquer chez le fournisseur, le remplacer dans Render/GitHub, redéployer et vérifier les logs.
- Documenter commit, incident, impact et remédiation.

## 16. Informations non fournies / à obtenir du propriétaire

- Identité légale, adresse postale et e-mail de contact confidentialité.
- Bundle ID iOS et package Android validés et détenus.
- Compte EAS et project ID.
- Comptes Apple Developer / App Store Connect et Google Play Console.
- Propriété du domaine et DNS si un domaine personnalisé est prévu.
- Statut exact du plan Supabase, sauvegardes, rétention et facturation.
- Phrase de chiffrement sauvegarde conservée dans un coffre, distincte des archives.
- Destinataire de test autorisé et domaine expéditeur Brevo validé.
- Décision sur le passage du dépôt public au privé.
- Inventaire des droits d'auteur et licences des assets ; vérifier que le code métier LIFTELY appartient bien au cédant et que le fichier `mobile/LICENSE` ne soit pas interprété comme une licence globale du produit.
- Décision commerciale : free/premium, abonnements, paiements, analytics, support.

## 17. Références officielles

- [Dépôt GitHub](https://github.com/skandergat/app-musculation)
- [Render service](https://dashboard.render.com/web/srv-datfsp5g1s2s7397nfe0)
- [Supabase project](https://supabase.com/dashboard/project/hzeggvylikhxpktbznqf)
- [Render health checks](https://render.com/docs/health-checks)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo app config](https://docs.expo.dev/workflow/configuration/)
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)

---
**Fin du dossier maître.** Les informations de ce document doivent être revalidées à chaque cession ou release majeure.
