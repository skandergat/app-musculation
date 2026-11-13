# Runbook d'exploitation

## Services
| Service | Configuration | Rôle |
|---|---|---|
| GitHub | skandergat/app-musculation | Code, PR, CI |
| Render | liftely-api, Oregon, Free | Flask/Gunicorn |
| Supabase | liftely, eu-west-2, PostgreSQL 17.11 | Base de production |
| Brevo | Compte propriétaire | E-mails transactionnels |

## Déploiement Render
État observé le 13 novembre 2026 : auto-deploy sur `main`, déclencheur `checksPass`, région Oregon, plan Free, Health Check Path `/health`. Le service a déployé le commit `68c3f20030b291a54861249c3c2813cbc02b4d4f` ; build et déploiement réussis, puis sondes `/health` en HTTP 200. Aucun build filter backend-only n'est confirmé : une modification de documentation peut donc encore déclencher un déploiement.
Branche main, racine backend/, auto-deploy actif.
- Build : pip install -r requirements.txt
- Start : gunicorn --bind 0.0.0.0:$PORT app:app

Après fusion, surveiller le déploiement et les logs. Ne pas changer plusieurs variables à la fois.
Contrôles non destructifs :
- GET /health : renvoie status, database_backend (sqlite/postgresql) et transactional_email_configured (booléen). Le booléen indique seulement que les paramètres sont présents.
- POST /health/brevo-sandbox : soumet une requête de test au endpoint transactionnel Brevo avec X-Sib-Sandbox: drop ; Brevo confirme l'API sans envoyer d'e-mail ni créer de log. Résultat mis en cache 5 minutes. Ce test valide la clé et le payload, pas la livraison réelle.
- GET /exercices : catalogue.
- GET /templates sans token : doit renvoyer 401.

**Health Check Path** est configuré sur `/health` (vérifié dans la configuration Render le 13 novembre 2026). Les journaux du dernier déploiement montrent plusieurs réponses HTTP 200 aux sondes Render.

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
À chaque release : CI générale + PostgreSQL, npm audit, pip-audit, lint, typecheck, traductions, Expo Doctor, export Web ; test des mots de passe (15 caractères minimum à l'inscription/reset, compatibilité des comptes existants) ; déploiement live ; /health 2xx avec PostgreSQL ; /exercices non vide ; routes privées 401 sans auth ; aucun log ERROR/FATAL.
Chaque mois : workflow GitHub mobile-dependency-maintenance (branche candidate à revoir, jamais auto-fusionnée), revue accès fournisseurs, vérification backup et restauration, quotas Render/Supabase/Brevo, rétention logs. Un workflow production-smoke vérifie quotidiennement /health (PostgreSQL), le probe Brevo sandbox sans livraison, les disclosures hébergeur/régions et le statut noindex de la page confidentialité, le catalogue et le refus 401 des routes privées.

## Sauvegarde Supabase (plan Free)
L'organisation Supabase est sur le plan Free : aucune sauvegarde quotidienne automatique n'est incluse. PITR est payant. Pour conserver le budget zéro, deux voies sont disponibles : workflow GitHub chiffré (après configuration des secrets) et dump manuel chiffré.

### Workflow GitHub Actions
Le workflow `.github/workflows/supabase-backup.yml` s'exécute quotidiennement à 04:00 UTC et peut être lancé manuellement. Il attend les secrets de dépôt `LIFTELY_DATABASE_URL` et `LIFTELY_BACKUP_PASSPHRASE` (au moins 32 caractères aléatoires). Sans les deux secrets, il saute proprement l'export. Lorsqu'ils sont présents, il exécute `pg_dump` avec PostgreSQL 17, vérifie le dump, chiffre en AES-256 GnuPG, vérifie le déchiffrement, puis publie uniquement l'archive chiffrée comme artifact pour 7 jours.

Le dépôt étant public, les artifacts peuvent être téléchargés par les lecteurs du dépôt. La protection repose donc sur une passphrase longue, unique et gardée hors de GitHub. Le run `43515211149` a réussi et a publié l'archive chiffrée `liftely-supabase-backup-43515211149` (rétention 7 jours). Copier l'archive vers un stockage privé indépendant avant expiration ; 7 jours d'artifacts ne constituent pas une sauvegarde hors site durable.

### Script manuel PowerShell
Le dépôt fournit également `scripts/backup-supabase.ps1`. Il requiert le client PostgreSQL 17+ (`pg_dump`/`pg_restore`) et 7-Zip. Il refuse d'écrire dans le dépôt Git, crée un dump custom, vérifie sa lisibilité, crée une archive 7z chiffrée AES-256 avec noms de fichiers chiffrés, vérifie l'archive puis supprime le dump temporaire.

Depuis une session PowerShell de confiance :
~~~powershell
$secureDsn = Read-Host "URI PostgreSQL" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDsn)
try {
  $env:LIFTELY_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  .\scripts\backup-supabase.ps1
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:LIFTELY_DATABASE_URL -ErrorAction SilentlyContinue
}
~~~

Le script demande deux fois la phrase secrète 7-Zip ; conserver cette phrase séparément de l'archive. Le fichier chiffré est créé par défaut dans %USERPROFILE%\LIFTELY-Backups. Copier ensuite ce fichier vers un stockage privé hors site. Ne jamais conserver un dump en clair dans GitHub, un artifact public ou un dossier synchronisé non chiffré. Le script n'envoie rien dans le cloud et ne crée pas de sauvegarde automatique.

### Test de restauration
1. Créer une base PostgreSQL isolée non-production.
2. Restaurer avec pg_restore --clean --if-exists --no-owner --no-acl --dbname <DSN_TEST> <dump>.
3. Vérifier tables, catalogue, séquences, contraintes et clés étrangères.
4. Exécuter le smoke test backend contre cette base.
5. Documenter date, résultat, RPO/RTO et supprimer la base temporaire.
Exercice de restauration réalisé avec succès (run `43518028317`) dans une base PostgreSQL 17 jetable : archive téléchargée, déchiffrée, restaurée et contrôlée ; les 349 exercices sont présents. La base Supabase de production n'a pas été modifiée. Conserver le rapport de run comme preuve et répéter périodiquement l'exercice.

## Brevo
Le backend utilise l'API transactionnelle HTTPS si LIFTELY_BREVO_API_KEY est configurée ; SMTP TLS existe en fallback. L'expéditeur doit être validé. Brevo propose le sandbox via header X-Sib-Sandbox: drop : valide payload/auth mais n'envoie aucun mail et ne crée aucun log. Test réel seulement avec un destinataire autorisé. Aucun test réel effectué.

## Régions
Render Oregon et Supabase Londres. Mesurer la latence avant décision. Déplacer Render exige un nouveau service dans une région européenne, copie des secrets, test et bascule avec rollback. Ne pas déplacer Supabase ni supprimer l'ancien service à l'aveugle.
