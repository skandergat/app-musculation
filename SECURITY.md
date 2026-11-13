# Politique de sécurité

## Signaler une vulnérabilité
Ne publiez pas de détails exploitables dans une issue publique. Utilisez la fonction GitHub Private Vulnerability Reporting du dépôt si elle est activée. À défaut, contactez le propriétaire du dépôt via un canal privé avant toute divulgation publique.

Inclure :
- composant et version affectés ;
- étapes minimales de reproduction ;
- impact potentiel ;
- preuve de concept non destructive ;
- correctif suggéré si connu.

Ne jamais joindre de mot de passe, jeton, URI PostgreSQL, clé Brevo, données d'utilisateur ou sauvegarde en clair.

## Réponse
Le mainteneur doit confirmer la réception, évaluer la gravité, protéger les données, faire tourner tout secret compromis, préparer un correctif et publier un avis après résolution.

## Périmètre critique
- Authentification et autorisation dans backend/app.py.
- Isolation inter-comptes des séances, séries et templates.
- Secrets Render/Supabase/Brevo/GitHub/EAS.
- Migrations et privilèges PostgreSQL.
- Données personnelles, journaux et sauvegardes.

## Sécurité opérationnelle
Voir docs/SECURITY_AND_PRIVACY.md et docs/INCIDENT_RESPONSE.md. Ne pas supposer que la présence de RLS suffit : vérifier les policies, grants et default privileges ensemble.
