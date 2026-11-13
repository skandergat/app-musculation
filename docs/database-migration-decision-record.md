# LIFTELY — décision de migration de base de données

**Statut : migration vers Supabase PostgreSQL exécutée et validée en production.**  
**Dernière vérification : 13 novembre 2026.**

## Décision et source de vérité

- **Source de vérité production :** projet Supabase `liftely`, PostgreSQL 17.11, région `eu-west-2` (Londres).
- **API production :** service Render `liftely-api`, région Oregon, connecté à Supabase via `LIFTELY_DATABASE_URL`.
- **Catalogue conservé :** 349 exercices, dont 337 actifs.
- **Comptes et historiques :** aucune donnée utilisateur n'a été importée. Les dix autres tables applicatives sont vides.

Le choix d'import a été réalisé à partir de la fixture SQLite assainie versionnée dans le dépôt : 349 exercices et aucune donnée de compte, séance, série ou template. Le workflow GitHub Actions [43309393635](https://github.com/skandergat/app-musculation/actions/runs/43309393635) a exécuté le préflight, l'import transactionnel, le postflight avec comparaison exacte et le smoke test API sur le vrai projet Supabase.

## Historique des deux fichiers SQLite locaux

Les deux anciennes bases locales inspectées en octobre 2026 n'étaient pas interchangeables : elles contenaient des comptes et historiques différents, parfois des identifiants identiques associés à des contenus différents. Il n'a donc pas été décidé de fusionner leurs utilisateurs ou séances par ID.

Cette divergence locale ne remet pas en cause la migration de production : la fixture assainie utilisée ne contenait aucun de ces comptes/historiques. Les fichiers locaux d'origine doivent rester des archives de référence et ne doivent pas être importés dans la production sans un nouveau projet de réconciliation explicitement approuvé.

## Vérifications de production

- Onze tables applicatives présentes.
- RLS activé sur les onze tables.
- Privilèges de tables et séquences retirés aux rôles Data API `anon` et `authenticated`.
- Aucun index manquant sur les clés étrangères après ajout de six index.
- Catalogue : 349 lignes, identifiants 1–349, aucun doublon, 337 actifs.
- API : `/health` OK, `/exercices` renvoie le catalogue, routes privées refusées sans authentification.
- Tests d'intégration PostgreSQL : adaptateur, import transactionnel, rollback, séquences et cycle complet compte/séance validés en CI.

## Garde-fous désormais applicables

1. Ne pas réimporter la fixture de staging : la production est déjà initialisée.
2. Ne pas importer les anciennes bases SQLite locales dans Supabase.
3. Ne pas supprimer ou tronquer les tables de production sans demande explicite, sauvegarde vérifiée et plan de retour arrière.
4. Utiliser PostgreSQL isolé ou une branche Supabase de test pour les nouveaux tests d'intégration.
5. Traiter Render et Supabase comme deux services distincts pour les sauvegardes : un rollback Render ne restaure pas la base.
6. Garder les secrets dans les variables d'environnement protégées uniquement.

## Points opérationnels restant à terminer

- Vérifier la rétention et la restauration des sauvegardes Supabase.
- Configurer le health-check Render sur `/health`.
- Réévaluer le décalage de région Render Oregon / Supabase Londres avant montée en charge.
- Effectuer un test de livraison Brevo avec un destinataire explicitement autorisé.
- Compléter les informations juridiques et la rétention des données dans la politique de confidentialité avant publication sur les stores.
