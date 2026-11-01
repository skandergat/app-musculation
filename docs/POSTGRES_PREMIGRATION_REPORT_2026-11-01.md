# LIFTELY — Rapport de pré-migration SQLite → PostgreSQL

**Date :** 1er novembre 2026  
**Périmètre :** copie de staging réinitialisée fournie dans la conversation  
**Base source :** `backend-musculation-reset-test.db`  
**SHA-256 de la base source téléversée :** `918e94c1d9c8290a00d7ba5fd312ca2ba046f742a54937ffbd13f31bde42aca8`  
**Taille :** 118 784 octets

## 1. Résumé exécutif

La copie SQLite fournie est saine et prête pour un import dans une base PostgreSQL vide, sur le schéma validé dans cette branche.

Le parcours complet a été exécuté avec PostgreSQL 16 dans un schéma temporaire isolé de GitHub Actions : précontrôle en lecture seule, import transactionnel, contrôle post-import et vérification de la séquence d'identité.

**Résultat du test réel de staging : PASS.** Aucune base Supabase ou Render n'a été contactée ou modifiée.

## 2. État de la base SQLite source

| Contrôle | Résultat |
|---|---:|
| Tables applicatives | 10 |
| Exercices | 349 |
| Comptes | 0 |
| Séances | 0 |
| Séries | 0 |
| Séances/exercices | 0 |
| Modèles | 0 |
| Modèles/exercices | 0 |
| Sessions d'authentification | 0 |
| Tokens d'action | 0 |
| Limites e-mail | 0 |
| `PRAGMA integrity_check` | `ok` |
| `PRAGMA foreign_key_check` | 0 erreur |
| Doublons parmi les exercices actifs (nom + catégorie) | 0 |

Répartition des exercices :
- Gym actifs : 185
- Gym inactifs : 12
- Calisthenics actifs : 152

Les données personnelles et historiques utilisateur sont absents de cette copie, conformément à la réinitialisation demandée. Les 349 exercices sont conservés.

## 3. Compatibilité du schéma PostgreSQL

Le schéma cible `backend/postgres_schema.sql` a été ajusté pour correspondre au schéma SQLite fourni.

Les colonnes de programmation d'exercices présentes dans la base source sont conservées :
- `template_exercices.nombre_series`
- `template_exercices.poids_prevu`
- `template_exercices.repetitions_prevues`
- `seance_exercices.nombre_series_prevu`
- `seance_exercices.poids_prevu`
- `seance_exercices.repetitions_prevues`

Le contrôle automatisé compare, pour les dix tables, les colonnes, affinités de types, nullabilité, valeurs par défaut, clés primaires, index/contraintes uniques et clés étrangères.

**Précontrôle PostgreSQL avant import :**
- Aucun blocage de schéma.
- Aucune clé étrangère manquante.
- Aucune clé étrangère supplémentaire.
- La table `exercices` est marquée `READY_FOR_IMPORT`.
- Les neuf autres tables, vides à la source, sont conformes à la cible vide.

## 4. Import sur cible PostgreSQL temporaire

Le test a créé un schéma PostgreSQL 16 temporaire et vide, puis appliqué le schéma cible et exécuté l'importeur existant.

| Table | Source SQLite | Après import |
|---|---:|---:|
| exercices | 349 | 349 |
| users | 0 | 0 |
| sessions | 0 | 0 |
| auth_action_tokens | 0 | 0 |
| auth_mail_limits | 0 | 0 |
| templates | 0 | 0 |
| template_exercices | 0 | 0 |
| seances | 0 | 0 |
| series | 0 | 0 |
| seance_exercices | 0 | 0 |
| **Total** | **349** | **349** |

L'import est exécuté dans une transaction PostgreSQL unique. Le test confirme aussi que le fichier SQLite source reste inchangé.

## 5. Contrôles après import

Le précontrôle a été relancé après l'import en lecture seule.

Résultats :
- Les dix tables sont en statut `CONTENT_MATCH`.
- Les contenus des lignes correspondent à la source.
- Les nombres de lignes correspondent dans chaque table.
- Aucune clé étrangère manquante ou supplémentaire.
- La séquence d'identité de `exercices.id` a été vérifiée par insertion d'essai : prochain identifiant obtenu = **350** ; la ligne d'essai a ensuite été supprimée.
- Le condensat SHA-256 du fichier SQLite de test est identique avant et après l'import.

Le schéma temporaire PostgreSQL a été supprimé à la fin du test.

## 6. Tests complémentaires

Le workflow PostgreSQL exécute également un test indépendant avec des lignes synthétiques dans chacune des dix tables. Il vérifie :
- l'import de données liées par clés étrangères ;
- la remise à niveau des séquences ;
- l'absence de modification de la source SQLite ;
- le rollback intégral lorsqu'une contrainte d'unicité est volontairement violée ;
- le cycle de vie compte/séance sur PostgreSQL.

Ces tests complémentaires ont réussi dans le même workflow.

## 7. Limites et décision

Cette validation prouve que **la copie réinitialisée fournie** est importable dans le schéma PostgreSQL testé. Elle ne constitue pas une migration de production.

La copie source ne contient aucun compte ni historique : les chemins de migration des données utilisateur ont été couverts par les tests synthétiques, mais pas par un export réel de données utilisateurs.

Avant toute bascule :
1. intégrer et faire relire les corrections de la PR #19 dans la branche d'intégration PostgreSQL ;
2. terminer la CI générale ;
3. effectuer une répétition contrôlée sur une vraie base de staging dédiée, avec une sauvegarde vérifiée ;
4. valider la configuration de connexion et les opérations de déploiement ;
5. obtenir une autorisation explicite avant toute modification de Supabase ou Render.

**Décision actuelle :** schéma et import de la copie réinitialisée validés en environnement PostgreSQL temporaire ; migration de production non autorisée et non exécutée.
