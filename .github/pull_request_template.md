## Résumé
<!-- Décrire le problème, la solution et l'impact utilisateur. -->

## Type de changement
- [ ] Correctif
- [ ] Fonctionnalité
- [ ] Sécurité / confidentialité
- [ ] Base de données / migration
- [ ] Infrastructure / CI
- [ ] Documentation

## Validation technique
- [ ] Tests ciblés ajoutés ou mis à jour
- [ ] CI complète verte : backend/mobile, npm audit, pip-audit, PostgreSQL integration, CodeQL
- [ ] TypeScript, ESLint, Expo Doctor et export Web vérifiés si le mobile est touché
- [ ] Traductions FR / EN / AR / DE synchronisées si un texte visible change
- [ ] Aucun avertissement ou erreur nouvelle non expliquée

## Sécurité et données
- [ ] Aucun secret, jeton, URI de base ou donnée personnelle dans le diff / logs / fixtures
- [ ] Authentification et autorisation testées (y compris accès anonyme et isolation inter-comptes)
- [ ] Les migrations SQL sont versionnées dans `supabase/migrations/`
- [ ] Compatibilité ascendante et rollback de schéma décrits
- [ ] Aucun test destructif exécuté sur la production
- [ ] RLS / privilèges / index vérifiés si le schéma change

## Produit, confidentialité et publication
- [ ] Écrans, états vides, erreurs et accessibilité vérifiés
- [ ] Politique de confidentialité / App Privacy / Data safety mise à jour si les données ou fournisseurs changent
- [ ] Permissions natives et liens profonds revus si la configuration Expo change
- [ ] EAS preview ou build native testée si un module natif change

## Déploiement et retour arrière
- [ ] Impact Render / Supabase / Brevo décrit
- [ ] Aucun envoi e-mail réel sans destinataire de test autorisé
- [ ] Plan de déploiement et de rollback documenté
- [ ] Vérifications post-déploiement définies (`/health`, `/exercices`, routes privées)

## Documentation
- [ ] Architecture, runbook, dossier maître ou guide de reprise mis à jour si nécessaire
- [ ] Issues liées et décisions techniques référencées

## Risques / points non couverts
<!-- Indiquer explicitement les limites, validations manuelles ou décisions du propriétaire. -->
