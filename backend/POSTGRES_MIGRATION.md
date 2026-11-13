# Migration PostgreSQL / Supabase — LIFTELY

## État de production vérifié au 13 novembre 2026

**État : production active sur PostgreSQL.**

- Projet Supabase `liftely`, région `eu-west-2` (Londres), PostgreSQL **17.11**.
- Service Render `liftely-api` : état `live`, branche `main`, racine `backend/`, déploiement automatique activé.
- Le backend Render utilise PostgreSQL/Supabase via `LIFTELY_DATABASE_URL`. La connexion a été confirmée par les requêtes de l'API et par la lecture directe de la base.
- `/health` a répondu `{"status":"ok"}` ; `/exercices` renvoie le catalogue actif ; le test d'intégration vérifie également le refus `401` de `/templates` sans authentification.
- Le déploiement du 13 novembre correspondant au commit `4a5e9d359e1c80e46408e88a0f065be6e1446b84` est `live`. Il ajoute la vérification de la table `auth_login_limits` au démarrage.
- Render est dans la région Oregon alors que Supabase est à Londres. Ce décalage géographique est un risque de latence à réévaluer avant une montée en charge.

## Données de production

Les onze tables applicatives attendues sont présentes dans le schéma `public`.

| Table | Lignes au dernier contrôle |
|---|---:|
| `exercices` | **349** |
| `users` | 0 |
| `sessions` | 0 |
| `auth_action_tokens` | 0 |
| `auth_mail_limits` | 0 |
| `auth_login_limits` | 0 |
| `templates` | 0 |
| `template_exercices` | 0 |
| `seances` | 0 |
| `series` | 0 |
| `seance_exercices` | 0 |

Le catalogue comprend 337 exercices actifs (185 gym et 152 calisthenics) et 12 exercices gym inactifs. Les identifiants du catalogue vont de 1 à 349, sans trou ni doublon. Aucun compte, historique, séance ou template local n'a été importé : la fixture assainie retenue ne contenait que les 349 exercices.

L'import transactionnel a été validé par GitHub Actions, run [43309393635](https://github.com/skandergat/app-musculation/actions/runs/43309393635). Le préflight, le postflight avec comparaison exacte du contenu des onze tables, les séquences, les clés étrangères et le smoke test Flask sur la vraie base Supabase ont réussi.

## Sécurité et index

- RLS est activé sur les onze tables.
- Les privilèges directs sur les tables et séquences du schéma `public` ont été retirés aux rôles `anon` et `authenticated`. Le mobile passe par l'API Flask, pas par la Data API Supabase.
- Supabase Security Advisor affiche encore l'information `RLS enabled no policy` sur les onze tables. C'est cohérent avec le choix de ne créer aucune politique d'accès direct ; l'accès Data API reste bloqué par l'absence de privilèges. Ne pas ajouter de politique permissive sans revoir l'architecture d'authentification.
- Six index ont été ajoutés sur les clés étrangères non indexées : `sessions.user_id`, `templates.user_id`, `template_exercices.exercice_id`, `seance_exercices.exercice_id`, `series.seance_id`, `series.exercice_id`.
- Le Performance Advisor ne signale plus de clé étrangère sans index. Les index « inutilisés » sur les tables vides ne doivent pas être supprimés sur cette seule base.
- Les privilèges par défaut du rôle créateur `postgres` dans `public` ont été entièrement révoqués pour `anon`, `authenticated` et `service_role` sur tables, séquences et fonctions. Les nouveaux objets n'accordent plus aucun privilège automatique à ces rôles ; les nouvelles permissions doivent être accordées explicitement. Les ACL du rôle interne `supabase_admin` ne sont pas modifiées.

## Historique des migrations

Les trois migrations appliquées en production sont désormais versionnées dans `supabase/migrations/` :

1. `20261112205509_enable_rls_auth_login_limits.sql`
2. `20261112212316_reconcile_auth_login_limits_table.sql`
3. `20261113094009_harden_public_schema_and_index_foreign_keys.sql`
4. `20261113100533_revoke_public_default_privileges.sql`\n5. `20261113102246_revoke_remaining_public_default_privileges.sql`

Ne pas rejouer une migration manuellement si elle figure déjà dans `supabase_migrations.schema_migrations`. Les fichiers versionnés doivent rester identiques aux instructions SQL enregistrées dans l'historique distant.

## Render et e-mails

- `LIFTELY_DATABASE_URL` est configurée dans l'environnement Render ; ne jamais copier sa valeur dans Git, un ticket ou une conversation.
- `LIFTELY_PUBLIC_BASE_URL` a été configurée à `https://liftely-api.onrender.com` pour construire les liens de vérification, de réinitialisation et de suppression de compte.
- Brevo est le fournisseur transactionnel prévu via API HTTPS. La configuration de l'URL publique a été faite, mais aucun e-mail réel n'a été envoyé pendant l'audit ; un test de livraison reste à faire avec un destinataire explicitement autorisé.
- Le chemin de contrôle HTTP Render n'est pas configuré (champ vide). L'API expose `/health` ; définir ce chemin dans le Dashboard Render lors du prochain durcissement opérationnel.

## Règles de sécurité opérationnelle

- Ne jamais réimporter la fixture de staging dans la production : le catalogue est déjà présent et les tables de comptes/historique sont volontairement vides.
- Ne jamais exécuter `DROP`, `TRUNCATE`, ou des commandes de purge sur la base de production sans demande explicite et sauvegarde vérifiée.
- Ne jamais publier une URI PostgreSQL, un mot de passe, une clé Supabase ou une clé Brevo.
- Pour tester les migrations, l'adaptateur et les parcours compte/séance, utiliser PostgreSQL isolé en CI ou une branche Supabase de test, pas la production.
- Pour un rollback applicatif, restaurer un déploiement Render précédent ne restaure pas automatiquement la base. La stratégie de sauvegarde et de restauration Supabase doit être vérifiée séparément.
