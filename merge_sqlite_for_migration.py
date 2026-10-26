import os
import shutil
import sqlite3
from pathlib import Path
from collections import Counter

ROOT = Path.cwd()
SOURCE_ROOT = ROOT / "musculation.db"
SOURCE_BACKEND = ROOT / "backend" / "musculation.db"
STAGING = ROOT / "migration_staging.db"

if not SOURCE_ROOT.is_file() or not SOURCE_BACKEND.is_file():
    raise SystemExit("ERREUR : une des bases sources est introuvable.")
if STAGING.exists():
    raise SystemExit("ARRÊT : migration_staging.db existe déjà. Ne pas l'écraser.")

def connect(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db

def rows(db, table):
    return db.execute(f'SELECT * FROM "{table}"').fetchall()

def norm_email(value):
    return (value or "").strip().casefold()

# Créer la copie de travail depuis le schéma backend le plus récent.
shutil.copy2(SOURCE_BACKEND, STAGING)
root = connect(SOURCE_ROOT)
dest = connect(STAGING)
dest.execute("DROP INDEX IF EXISTS idx_seances_active_user")

stats = Counter()
try:
    dest.execute("BEGIN IMMEDIATE")

    # Associer les comptes par email ; créer les comptes racine absents.
    users_dest = {
        norm_email(r["email"]): r["id"]
        for r in dest.execute("SELECT id, email FROM users")
        if norm_email(r["email"])
    }
    user_map = {}

    for u in rows(root, "users"):
        email_key = norm_email(u["email"])
        if email_key and email_key in users_dest:
            user_map[u["id"]] = users_dest[email_key]
            stats["comptes_associes"] += 1
            continue

        cur = dest.execute(
            """INSERT INTO users
               (nom, email, password_hash, date_creation, email_verified_at)
               VALUES (?, ?, ?, ?, NULL)""",
            (u["nom"], u["email"], u["password_hash"], u["date_creation"])
        )
        new_id = cur.lastrowid
        user_map[u["id"]] = new_id
        if email_key:
            users_dest[email_key] = new_id
        stats["comptes_ajoutes"] += 1

    # Fusionner les séances : si l'ID existe et que le contenu mappé
    # est identique, réutiliser la séance ; sinon créer une nouvelle ligne.
    session_map = {}
    dest_sessions = {
        r["id"]: r for r in dest.execute(
            "SELECT id, date_debut, date_fin, user_id FROM seances"
        )
    }

    for s in rows(root, "seances"):
        mapped_user = user_map.get(s["user_id"]) if s["user_id"] is not None else None
        existing = dest_sessions.get(s["id"])
        signature = (s["date_debut"], s["date_fin"], mapped_user)

        if existing and (
            existing["date_debut"], existing["date_fin"], existing["user_id"]
        ) == signature:
            session_map[s["id"]] = s["id"]
            stats["seances_identiques_reutilisees"] += 1
            continue

        cur = dest.execute(
            "INSERT INTO seances (date_debut, date_fin, user_id) VALUES (?, ?, ?)",
            (s["date_debut"], s["date_fin"], mapped_user)
        )
        new_id = cur.lastrowid
        session_map[s["id"]] = new_id
        stats["seances_ajoutees"] += 1

    # Fusionner les séries sans supprimer les répétitions légitimes :
    # on compare les occurrences de chaque signature dans chaque séance.
    existing_counts = Counter(
        (r["seance_id"], r["exercice_id"], r["poids"], r["repetitions"])
        for r in dest.execute(
            "SELECT seance_id, exercice_id, poids, repetitions FROM series"
        )
    )
    root_counts = Counter()

    for s in rows(root, "series"):
        mapped_session = session_map.get(s["seance_id"])
        if mapped_session is None:
            raise RuntimeError(
                f"Série {s['id']} : séance source {s['seance_id']} non associée."
            )

        signature = (
            mapped_session, s["exercice_id"], s["poids"], s["repetitions"]
        )
        root_counts[signature] += 1

        if root_counts[signature] <= existing_counts[signature]:
            stats["series_identiques_reutilisees"] += 1
            continue

        dest.execute(
            """INSERT INTO series (seance_id, exercice_id, poids, repetitions)
               VALUES (?, ?, ?, ?)""",
            (mapped_session, s["exercice_id"], s["poids"], s["repetitions"])
        )
        stats["series_ajoutees"] += 1

    # Vérifications avant validation de la transaction.
    fk_errors = dest.execute("PRAGMA foreign_key_check").fetchall()
    integrity = dest.execute("PRAGMA integrity_check").fetchone()[0]
    if fk_errors or integrity != "ok":
        raise RuntimeError(
            f"Vérification échouée : integrity={integrity}, "
            f"foreign_key_errors={len(fk_errors)}"
        )

    dest.commit()

    print("FUSION TERMINÉE — base temporaire uniquement")
    print(f"Fichier : {STAGING}")
    for key, value in sorted(stats.items()):
        print(f"{key}: {value}")

    print("\nTotaux dans la base temporaire :")
    for table in (
        "users", "exercices", "seances", "series",
        "templates", "template_exercices", "seance_exercices"
    ):
        exists = dest.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table,)
        ).fetchone()
        if exists:
            count = dest.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            print(f"{table}: {count}")

    print(f"\nIntegrity check : {integrity}")
    print(f"Erreurs de clés étrangères : {len(fk_errors)}")
    print("Les bases sources n'ont pas été modifiées.")
except Exception:
    dest.rollback()
    raise
finally:
    root.close()
    dest.close()

