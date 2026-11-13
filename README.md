# LIFTELY — portail développeur et transfert

LIFTELY est une application mobile de suivi de musculation et de calisthenics. Ce dépôt contient le client Expo/React Native, l'API Flask, les scripts de migration et les migrations Supabase.

**Production :** API Render https://liftely-api.onrender.com → Supabase PostgreSQL 17.11, région Londres (eu-west-2). Ne jamais exécuter de tests destructifs sur cette API ou cette base.

## Dossier de reprise
- [Dossier maître complet (produit, technique et exploitation)](docs/PROJECT_MASTER_DOSSIER.md)
- [Guide de reprise développeur](docs/DEVELOPER_HANDOVER.md)
- [Matrice des variables, secrets et accès fournisseurs](docs/ENVIRONMENT_AND_ACCESS_MATRIX.md)
- [Architecture et cartographie du code](docs/ARCHITECTURE.md)
- [Runbook d'exploitation](docs/OPERATIONS_RUNBOOK.md)
- [Sécurité et confidentialité](docs/SECURITY_AND_PRIVACY.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Builds et publication mobile](docs/RELEASE_AND_EAS.md)
- [Réponse aux incidents et restauration](docs/INCIDENT_RESPONSE.md)
- [Checklist de transfert de propriété](docs/OWNERSHIP_TRANSFER.md)
- [Inventaire confidentialité stores](docs/store-privacy-inventory.md)
- [Migration PostgreSQL](backend/POSTGRES_MIGRATION.md)
- [Guide de contribution](CONTRIBUTING.md)
- [Politique de sécurité](SECURITY.md)

## Technologies
| Couche | Technologie |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86, TypeScript, Expo Router |
| API | Python 3.12, Flask 3, Gunicorn |
| Base | Supabase PostgreSQL 17 |
| Local | SQLite |
| E-mails | Brevo Transactional API HTTPS, SMTP TLS en fallback |
| CI | GitHub Actions |
| Hébergement API | Render |

## Contrôles automatisés
- CI backend/mobile et intégration PostgreSQL sur GitHub Actions.
- Smoke check quotidien de l'API de production : PostgreSQL, Brevo sandbox sans livraison, page confidentialité, catalogue et autorisation.
- CodeQL hebdomadaire sur Python et JavaScript/TypeScript.
- Dependabot mensuel pour npm, pip et GitHub Actions ; versions Expo/React Native protégées contre les upgrades hors SDK.
- Maintenance mensuelle des dépendances mobiles via branche candidate et revue humaine.

## Règles impératives
1. Aucun secret, URI PostgreSQL, clé Brevo ou clé Supabase dans Git.
2. Ne jamais pointer les tests/migrations vers la production.
3. Ne jamais réimporter la fixture de staging dans la base de production déjà initialisée.
4. Toute évolution SQL doit être versionnée, relue et vérifiée.
5. Toute opération destructive exige sauvegarde vérifiée, rollback et approbation.
6. Un rollback Render ne restaure pas Supabase.

Documentation actualisée le 13 novembre 2026. Les valeurs de rétention, l'identité juridique, les identifiants stores et les accès du propriétaire restent à confirmer.
