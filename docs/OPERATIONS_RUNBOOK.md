# Runbook d'exploitation

## Services
| Service | Configuration | Rôle |
|---|---|---|
| GitHub | skandergat/app-musculation | Code, PR, CI |
| Render | liftely-api, Oregon, Free | Flask/Gunicorn |
| Supabase | liftely, eu-west-2, PostgreSQL 17.11 | Base de production |
| Brevo | Compte propriétaire | E-mails transactionnels |

## Déploiement Render
Branche main, racine backend/, auto-deploy actif.
- Build : pip install -r requirements.txt
- Start : gunicorn --bind 0.0.0.0:$PORT app:app

Après fusion, surveiller le déploiement et les logs. Ne pas changer plusieurs variables à la fois.
Contrôles non destructifs :
- GET /health : santé de l'API et connexion DB selon implémentation.
- GET /exercices : catalogue.
- GET /templates sans token : doit renvoyer 401.

**Health Check Path** est vide au dernier contrôle. À configurer dans Render Dashboard > liftely-api > Settings > Health & Checks > Health Check Path : /health. Les outils disponibles ici ne permettent pas de modifier ce champ ; ne pas prétendre qu'il est configuré.

## Variables
| Variable | Usage | Secret |
|---|---|---|
| LIFTELY_DATABASE_URL | URI PostgreSQL | Oui, critique |
| LIFTELY_BREVO_API_KEY | API Brevo | Oui, critique |
| LIFTELY_PUBLIC_BASE_URL | Base des liens e-mail | Non |
| LIFTELY_EMAIL_FROM | Expéditeur | Non |
| LIFTELY_EMAIL_SENDER_NAME | Nom expéditeur | Non |
| LIFTELY_EMAIL_PROVIDER | Fournisseur | Non |
| LIFTELY_SMTP_PASSWORD | Fallback SMTP | Oui |
| LIFTELY_SMTP_HOST/PORT/USERNAME/USE_SSL | SMTP | Username sensible |
| LIFTELY_CORS_ORIGINS | Allowlist Web | Non |
| LIFTELY_DATA_CONTROLLER / ADDRESS / PRIVACY_CONTACT | Données juridiques | Non |
| LIFTELY_HOSTING_PROVIDER / REGION | Hébergement | Non |
| LIFTELY_BACKUP_RETENTION / LOG_RETENTION | Durées de rétention | Non |
EXPO_PUBLIC_API_URL est publique et ne doit jamais contenir de secret.

## Contrôles périodiques
À chaque release : CI générale + PostgreSQL, lint, typecheck, traductions, Expo Doctor, export Web ; déploiement live ; /health 2xx ; /exercices non vide ; routes privées 401 sans auth ; aucun log ERROR/FATAL.
Chaque mois : npm audit/Expo Doctor, revue accès fournisseurs, vérification backup et restauration, quotas Render/Supabase/Brevo, rétention logs.

## Sauvegarde Supabase (plan Free)
La documentation Supabase indique que les projets Free n'ont pas de sauvegarde quotidienne automatique ; Pro/Team/Enterprise en ont. PITR est payant. Pour conserver le budget zéro, faire un dump logique manuel chiffré hors du dépôt Git public.

Exemple opérateur PowerShell depuis un poste de confiance avec client PostgreSQL installé :
~~~powershell
$env:LIFTELY_DATABASE_URL = Read-Host "URI PostgreSQL (ne pas la coller dans un ticket)"
pg_dump --format=custom --no-owner --no-acl --file ".\liftely-$(Get-Date -Format yyyyMMdd-HHmmss).dump" "$env:LIFTELY_DATABASE_URL"
pg_restore --list ".\liftely-AAAAmmjj-HHmmss.dump"
# Chiffrer avec age ou 7-Zip AES-256 ; conserver la clé séparément du fichier.
Remove-Item Env:LIFTELY_DATABASE_URL
~~~

Ne pas conserver un dump en clair dans GitHub, un artifact public ou un dossier synchronisé non chiffré. Vérifier le dump, chiffrer, copier hors site et supprimer le fichier en clair.

### Test de restauration
1. Créer une base PostgreSQL isolée non-production.
2. Restaurer avec pg_restore --clean --if-exists --no-owner --no-acl --dbname <DSN_TEST> <dump>.
3. Vérifier tables, catalogue, séquences, contraintes et clés étrangères.
4. Exécuter le smoke test backend contre cette base.
5. Documenter date, résultat, RPO/RTO et supprimer la base temporaire.
Aucune sauvegarde réelle ni restauration n'a été exécutée pendant cet audit ; pratiquer la procédure avant lancement public.

## Brevo
Le backend utilise l'API transactionnelle HTTPS si LIFTELY_BREVO_API_KEY est configurée ; SMTP TLS existe en fallback. L'expéditeur doit être validé. Brevo propose le sandbox via header X-Sib-Sandbox: drop : valide payload/auth mais n'envoie aucun mail et ne crée aucun log. Test réel seulement avec un destinataire autorisé. Aucun test réel effectué.

## Régions
Render Oregon et Supabase Londres. Mesurer la latence avant décision. Déplacer Render exige un nouveau service dans une région européenne, copie des secrets, test et bascule avec rollback. Ne pas déplacer Supabase ni supprimer l'ancien service à l'aveugle.
