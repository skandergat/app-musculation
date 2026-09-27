from flask import Flask, jsonify, request
import sqlite3
from datetime import datetime, timedelta
import hashlib
import secrets
import re
import os

app = Flask(__name__)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("LIFTELY_DB_PATH", str(BASE_DIR / "musculation.db"))
SESSION_DURATION_DAYS = 30


# ============================================================
# OUTILS
# ============================================================

def hash_password(password, salt=None):
    """
    Hash sécurisé du mot de passe avec PBKDF2-HMAC-SHA256.
    """
    if salt is None:
        salt = secrets.token_bytes(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        200_000,
    )

    return f"{salt.hex()}${password_hash.hex()}"


def verify_password(password, stored_hash):
    """
    Vérifie un mot de passe contre son hash.
    """
    try:
        salt_hex, hash_hex = stored_hash.split("$")
        salt = bytes.fromhex(salt_hex)

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            200_000,
        )

        return secrets.compare_digest(
            password_hash.hex(),
            hash_hex,
        )
    except Exception:
        return False


def hash_token(token):
    """
    Hash du token de session avant stockage en base.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def email_valide(email):
    """
    Validation simple de l'adresse email.
    """
    pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    return re.match(pattern, email) is not None


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


# ============================================================
# AUTHENTIFICATION
# ============================================================

def get_user_from_request():
    """
    Récupère l'utilisateur connecté grâce au header :

    Authorization: Bearer TOKEN
    """

    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()

    if not token:
        return None

    token_hash = hash_token(token)

    conn = get_db()

    conn.execute(
        "DELETE FROM sessions WHERE date_expiration <= ?",
        (datetime.now().isoformat(),),
    )
    conn.commit()

    user = conn.execute(
        """
        SELECT users.id, users.nom, users.email, users.date_creation
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
          AND sessions.date_expiration > ?
        """,
        (token_hash, datetime.now().isoformat()),
    ).fetchone()

    conn.close()

    return user


def utilisateur_non_connecte():
    return jsonify({
        "error": "Authentification requise"
    }), 401


# ============================================================
# INITIALISATION DE LA BASE
# ============================================================

def assurer_base():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # --------------------------------------------------------
    # EXERCICES
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            groupe_musculaire TEXT,
            categorie TEXT NOT NULL DEFAULT 'gym',
            actif INTEGER NOT NULL DEFAULT 1
        )
    """)

    # Migration : catégorie de pratique (gym / calisthenics)
    colonnes_exercices = cursor.execute(
        "PRAGMA table_info(exercices)"
    ).fetchall()

    noms_colonnes_exercices = [colonne[1] for colonne in colonnes_exercices]

    if "categorie" not in noms_colonnes_exercices:
        cursor.execute(
            "ALTER TABLE exercices ADD COLUMN categorie TEXT NOT NULL DEFAULT 'gym'"
        )

    if "actif" not in noms_colonnes_exercices:
        cursor.execute(
            "ALTER TABLE exercices ADD COLUMN actif INTEGER NOT NULL DEFAULT 1"
        )

    # --------------------------------------------------------
    # UTILISATEURS
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            date_creation TEXT NOT NULL
        )
    """)

    # --------------------------------------------------------
    # SESSIONS DE CONNEXION
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date_creation TEXT NOT NULL,
            date_expiration TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    # Migration : expiration des sessions pour les bases existantes
    colonnes_sessions = cursor.execute(
        "PRAGMA table_info(sessions)"
    ).fetchall()
    noms_colonnes_sessions = [colonne[1] for colonne in colonnes_sessions]
    if "date_expiration" not in noms_colonnes_sessions:
        cursor.execute(
            "ALTER TABLE sessions ADD COLUMN date_expiration TEXT"
        )
        expiration_defaut = (
            datetime.now() + timedelta(days=SESSION_DURATION_DAYS)
        ).isoformat()
        cursor.execute(
            "UPDATE sessions SET date_expiration = ? WHERE date_expiration IS NULL",
            (expiration_defaut,),
        )

    # --------------------------------------------------------
    # SEANCES
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS seances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_debut TEXT NOT NULL,
            date_fin TEXT
        )
    """)

    # --------------------------------------------------------
    # MIGRATION AUTOMATIQUE :
    # AJOUT DE user_id SI LA COLONNE N'EXISTE PAS
    # --------------------------------------------------------

    colonnes_seances = cursor.execute(
        "PRAGMA table_info(seances)"
    ).fetchall()

    noms_colonnes = [colonne[1] for colonne in colonnes_seances]

    if "user_id" not in noms_colonnes:
        cursor.execute(
            "ALTER TABLE seances ADD COLUMN user_id INTEGER"
        )

    # Une seule séance active par utilisateur. Les anciennes séances
    # actives en double sont clôturées en conservant la plus récente.
    maintenant = datetime.now().isoformat()
    cursor.execute(
        """
        UPDATE seances
        SET date_fin = ?
        WHERE date_fin IS NULL
          AND user_id IS NOT NULL
          AND id NOT IN (
              SELECT MAX(id)
              FROM seances
              WHERE date_fin IS NULL
                AND user_id IS NOT NULL
              GROUP BY user_id
          )
        """,
        (maintenant,),
    )

    cursor.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_seances_active_user
        ON seances(user_id)
        WHERE date_fin IS NULL
          AND user_id IS NOT NULL
        """
    )

    # --------------------------------------------------------
    # SERIES
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL,
            exercice_id INTEGER NOT NULL,
            poids REAL,
            repetitions INTEGER,
            FOREIGN KEY (seance_id) REFERENCES seances (id),
            FOREIGN KEY (exercice_id) REFERENCES exercices (id)
        )
    """)

    # --------------------------------------------------------
    # EXERCICES PRESENTS DANS UNE SEANCE
    # --------------------------------------------------------
    # Sépare la composition de la séance des séries déjà validées.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS seance_exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL,
            exercice_id INTEGER NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            date_ajout TEXT NOT NULL,
            UNIQUE(seance_id, exercice_id),
            FOREIGN KEY (seance_id) REFERENCES seances (id) ON DELETE CASCADE,
            FOREIGN KEY (exercice_id) REFERENCES exercices (id)
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_seance_exercices_seance
        ON seance_exercices(seance_id, position)
    """)

    # --------------------------------------------------------
    # BIBLIOTHÈQUE GYM
    # --------------------------------------------------------
    # Tous les exercices appartiennent pour l'instant à la catégorie
    # GYM côté application. Le groupe_musculaire reste une information
    # interne utile pour les futures fonctionnalités de recherche/filtre.
    exercices_gym = [
          [
                    "Développé couché",
                    "Pectoraux"
          ],
          [
                    "Développé couché haltères",
                    "Pectoraux"
          ],
          [
                    "Développé incliné barre",
                    "Pectoraux"
          ],
          [
                    "Développé incliné haltères",
                    "Pectoraux"
          ],
          [
                    "Développé décliné barre",
                    "Pectoraux"
          ],
          [
                    "Développé décliné haltères",
                    "Pectoraux"
          ],
          [
                    "Chest press machine",
                    "Pectoraux"
          ],
          [
                    "Chest press convergente",
                    "Pectoraux"
          ],
          [
                    "Développé Hammer Strength",
                    "Pectoraux"
          ],
          [
                    "Écarté haltères",
                    "Pectoraux"
          ],
          [
                    "Écarté incliné haltères",
                    "Pectoraux"
          ],
          [
                    "Écarté décliné haltères",
                    "Pectoraux"
          ],
          [
                    "Pec deck",
                    "Pectoraux"
          ],
          [
                    "Crossover poulie",
                    "Pectoraux"
          ],
          [
                    "Crossover haut vers bas",
                    "Pectoraux"
          ],
          [
                    "Crossover bas vers haut",
                    "Pectoraux"
          ],
          [
                    "Pompes",
                    "Pectoraux"
          ],
          [
                    "Pompes lestées",
                    "Pectoraux"
          ],
          [
                    "Pompes inclinées",
                    "Pectoraux"
          ],
          [
                    "Pompes déclinées",
                    "Pectoraux"
          ],
          [
                    "Dips poitrine",
                    "Pectoraux"
          ],
          [
                    "Tractions pronation",
                    "Dos"
          ],
          [
                    "Tractions supination",
                    "Dos"
          ],
          [
                    "Tractions prise neutre",
                    "Dos"
          ],
          [
                    "Tractions lestées",
                    "Dos"
          ],
          [
                    "Tirage vertical",
                    "Dos"
          ],
          [
                    "Tirage vertical prise large",
                    "Dos"
          ],
          [
                    "Tirage vertical prise serrée",
                    "Dos"
          ],
          [
                    "Tirage vertical supination",
                    "Dos"
          ],
          [
                    "Rowing barre",
                    "Dos"
          ],
          [
                    "Rowing Pendlay",
                    "Dos"
          ],
          [
                    "Rowing T-bar",
                    "Dos"
          ],
          [
                    "Rowing haltère unilatéral",
                    "Dos"
          ],
          [
                    "Rowing machine",
                    "Dos"
          ],
          [
                    "Rowing poulie basse",
                    "Dos"
          ],
          [
                    "Rowing assis",
                    "Dos"
          ],
          [
                    "Rowing poitrine supportée",
                    "Dos"
          ],
          [
                    "Tirage horizontal",
                    "Dos"
          ],
          [
                    "Pullover haltère",
                    "Dos"
          ],
          [
                    "Pullover poulie",
                    "Dos"
          ],
          [
                    "Straight-arm pulldown",
                    "Dos"
          ],
          [
                    "Shrugs barre",
                    "Trapèzes"
          ],
          [
                    "Shrugs haltères",
                    "Trapèzes"
          ],
          [
                    "Shrugs machine",
                    "Trapèzes"
          ],
          [
                    "Développé militaire barre",
                    "Épaules"
          ],
          [
                    "Développé militaire haltères",
                    "Épaules"
          ],
          [
                    "Développé Arnold",
                    "Épaules"
          ],
          [
                    "Shoulder press machine",
                    "Épaules"
          ],
          [
                    "Shoulder press convergente",
                    "Épaules"
          ],
          [
                    "Élévations latérales haltères",
                    "Épaules"
          ],
          [
                    "Élévations latérales poulie",
                    "Épaules"
          ],
          [
                    "Élévations latérales machine",
                    "Épaules"
          ],
          [
                    "Élévations frontales haltères",
                    "Épaules"
          ],
          [
                    "Élévations frontales barre",
                    "Épaules"
          ],
          [
                    "Élévations frontales poulie",
                    "Épaules"
          ],
          [
                    "Oiseau haltères",
                    "Épaules"
          ],
          [
                    "Oiseau machine",
                    "Épaules"
          ],
          [
                    "Reverse pec deck",
                    "Épaules"
          ],
          [
                    "Face pull",
                    "Épaules"
          ],
          [
                    "Cuban press",
                    "Épaules"
          ],
          [
                    "Upright row barre",
                    "Épaules"
          ],
          [
                    "Upright row poulie",
                    "Épaules"
          ],
          [
                    "Curl barre droite",
                    "Biceps"
          ],
          [
                    "Curl barre EZ",
                    "Biceps"
          ],
          [
                    "Curl haltères",
                    "Biceps"
          ],
          [
                    "Curl alterné",
                    "Biceps"
          ],
          [
                    "Curl marteau",
                    "Biceps"
          ],
          [
                    "Curl marteau croisé",
                    "Biceps"
          ],
          [
                    "Curl incliné",
                    "Biceps"
          ],
          [
                    "Curl pupitre",
                    "Biceps"
          ],
          [
                    "Curl pupitre machine",
                    "Biceps"
          ],
          [
                    "Curl concentration",
                    "Biceps"
          ],
          [
                    "Curl câble",
                    "Biceps"
          ],
          [
                    "Curl câble unilatéral",
                    "Biceps"
          ],
          [
                    "Bayesian curl",
                    "Biceps"
          ],
          [
                    "Spider curl",
                    "Biceps"
          ],
          [
                    "Drag curl",
                    "Biceps"
          ],
          [
                    "Reverse curl",
                    "Biceps"
          ],
          [
                    "Zottman curl",
                    "Biceps"
          ],
          [
                    "Extension poulie corde",
                    "Triceps"
          ],
          [
                    "Extension poulie barre",
                    "Triceps"
          ],
          [
                    "Extension poulie prise inversée",
                    "Triceps"
          ],
          [
                    "Extension unilatérale poulie",
                    "Triceps"
          ],
          [
                    "Skull crushers",
                    "Triceps"
          ],
          [
                    "Barre front",
                    "Triceps"
          ],
          [
                    "Extension haltère au-dessus de la tête",
                    "Triceps"
          ],
          [
                    "Extension câble au-dessus de la tête",
                    "Triceps"
          ],
          [
                    "Extension française",
                    "Triceps"
          ],
          [
                    "Kickback haltère",
                    "Triceps"
          ],
          [
                    "Kickback poulie",
                    "Triceps"
          ],
          [
                    "Dips triceps",
                    "Triceps"
          ],
          [
                    "Développé couché prise serrée",
                    "Triceps"
          ],
          [
                    "JM Press",
                    "Triceps"
          ],
          [
                    "Squat barre",
                    "Quadriceps"
          ],
          [
                    "Front squat",
                    "Quadriceps"
          ],
          [
                    "Hack squat",
                    "Quadriceps"
          ],
          [
                    "Hack squat machine",
                    "Quadriceps"
          ],
          [
                    "Leg press",
                    "Quadriceps"
          ],
          [
                    "Leg press horizontale",
                    "Quadriceps"
          ],
          [
                    "Leg press inclinée",
                    "Quadriceps"
          ],
          [
                    "Bulgarian split squat",
                    "Quadriceps"
          ],
          [
                    "Fentes avant",
                    "Quadriceps"
          ],
          [
                    "Fentes arrière",
                    "Quadriceps"
          ],
          [
                    "Fentes marchées",
                    "Quadriceps"
          ],
          [
                    "Fentes haltères",
                    "Quadriceps"
          ],
          [
                    "Fentes barre",
                    "Quadriceps"
          ],
          [
                    "Step-up",
                    "Quadriceps"
          ],
          [
                    "Sissy squat",
                    "Quadriceps"
          ],
          [
                    "Leg extension",
                    "Quadriceps"
          ],
          [
                    "Spanish squat",
                    "Quadriceps"
          ],
          [
                    "Belt squat",
                    "Quadriceps"
          ],
          [
                    "Goblet squat",
                    "Quadriceps"
          ],
          [
                    "Romanian deadlift",
                    "Ischio-jambiers"
          ],
          [
                    "Romanian deadlift haltères",
                    "Ischio-jambiers"
          ],
          [
                    "Soulevé de terre jambes tendues",
                    "Ischio-jambiers"
          ],
          [
                    "Leg curl allongé",
                    "Ischio-jambiers"
          ],
          [
                    "Leg curl assis",
                    "Ischio-jambiers"
          ],
          [
                    "Leg curl debout",
                    "Ischio-jambiers"
          ],
          [
                    "Nordic curl",
                    "Ischio-jambiers"
          ],
          [
                    "Glute ham raise",
                    "Ischio-jambiers"
          ],
          [
                    "Good morning",
                    "Ischio-jambiers"
          ],
          [
                    "Kettlebell swing",
                    "Ischio-jambiers"
          ],
          [
                    "Hip thrust barre",
                    "Fessiers"
          ],
          [
                    "Hip thrust machine",
                    "Fessiers"
          ],
          [
                    "Hip thrust unilatéral",
                    "Fessiers"
          ],
          [
                    "Glute bridge",
                    "Fessiers"
          ],
          [
                    "Glute bridge lesté",
                    "Fessiers"
          ],
          [
                    "Cable kickback",
                    "Fessiers"
          ],
          [
                    "Kickback machine",
                    "Fessiers"
          ],
          [
                    "Abduction machine",
                    "Fessiers"
          ],
          [
                    "Abduction poulie",
                    "Fessiers"
          ],
          [
                    "Frog pumps",
                    "Fessiers"
          ],
          [
                    "Step-up haut",
                    "Fessiers"
          ],
          [
                    "Sumo squat",
                    "Fessiers"
          ],
          [
                    "Standing calf raise",
                    "Mollets"
          ],
          [
                    "Seated calf raise",
                    "Mollets"
          ],
          [
                    "Calf raise à la presse",
                    "Mollets"
          ],
          [
                    "Calf raise machine",
                    "Mollets"
          ],
          [
                    "Calf raise unilatéral",
                    "Mollets"
          ],
          [
                    "Donkey calf raise",
                    "Mollets"
          ],
          [
                    "Tibialis raise",
                    "Mollets"
          ],
          [
                    "Crunch",
                    "Abdominaux"
          ],
          [
                    "Crunch lesté",
                    "Abdominaux"
          ],
          [
                    "Crunch poulie",
                    "Abdominaux"
          ],
          [
                    "Crunch machine",
                    "Abdominaux"
          ],
          [
                    "Sit-up",
                    "Abdominaux"
          ],
          [
                    "Sit-up lesté",
                    "Abdominaux"
          ],
          [
                    "Reverse crunch",
                    "Abdominaux"
          ],
          [
                    "Hanging leg raise",
                    "Abdominaux"
          ],
          [
                    "Hanging knee raise",
                    "Abdominaux"
          ],
          [
                    "Leg raise au sol",
                    "Abdominaux"
          ],
          [
                    "Leg raise chaise romaine",
                    "Abdominaux"
          ],
          [
                    "Ab wheel",
                    "Abdominaux"
          ],
          [
                    "Planche",
                    "Abdominaux"
          ],
          [
                    "Side plank",
                    "Abdominaux"
          ],
          [
                    "Mountain climbers",
                    "Abdominaux"
          ],
          [
                    "Russian twist",
                    "Abdominaux"
          ],
          [
                    "Russian twist lesté",
                    "Abdominaux"
          ],
          [
                    "Bicycle crunch",
                    "Abdominaux"
          ],
          [
                    "Dead bug",
                    "Abdominaux"
          ],
          [
                    "Pallof press",
                    "Abdominaux"
          ],
          [
                    "Woodchopper poulie",
                    "Abdominaux"
          ],
          [
                    "Cable rotation",
                    "Abdominaux"
          ],
          [
                    "V-up",
                    "Abdominaux"
          ],
          [
                    "L-sit",
                    "Abdominaux"
          ],
          [
                    "Wrist curl",
                    "Avant-bras"
          ],
          [
                    "Reverse wrist curl",
                    "Avant-bras"
          ],
          [
                    "Farmer's walk",
                    "Avant-bras"
          ],
          [
                    "Plate pinch",
                    "Avant-bras"
          ],
          [
                    "Dead hang",
                    "Avant-bras"
          ],
          [
                    "Grip trainer",
                    "Avant-bras"
          ],
          [
                    "Soulevé de terre",
                    "Full body"
          ],
          [
                    "Sumo deadlift",
                    "Full body"
          ],
          [
                    "Trap bar deadlift",
                    "Full body"
          ],
          [
                    "Clean",
                    "Full body"
          ],
          [
                    "Power clean",
                    "Full body"
          ],
          [
                    "Clean & press",
                    "Full body"
          ],
          [
                    "Snatch",
                    "Full body"
          ],
          [
                    "Kettlebell clean",
                    "Full body"
          ],
          [
                    "Kettlebell snatch",
                    "Full body"
          ],
          [
                    "Turkish get-up",
                    "Full body"
          ],
          [
                    "Thruster",
                    "Full body"
          ],
          [
                    "Dumbbell clean",
                    "Full body"
          ],
          [
                    "Dumbbell snatch",
                    "Full body"
          ],
          [
                    "Man makers",
                    "Full body"
          ]
]

    # --------------------------------------------------------
    # BIBLIOTHÈQUE CALISTHENICS
    # --------------------------------------------------------
    # Bibliothèque large de mouvements au poids du corps, statiques,
    # skills et progressions. Les exercices déjà présents dans GYM
    # restent dans GYM même si un mouvement similaire existe ici.
    exercices_calisthenics = [
        ("Pompes", "Pectoraux"),
        ("Pompes diamant", "Pectoraux"),
        ("Pompes larges", "Pectoraux"),
        ("Pompes serrées", "Pectoraux"),
        ("Pompes déclinées", "Pectoraux"),
        ("Pompes inclinées", "Pectoraux"),
        ("Pompes archer", "Pectoraux"),
        ("Pompes pseudo-planche", "Pectoraux"),
        ("Pompes hindoues", "Pectoraux"),
        ("Pompes dive bomber", "Pectoraux"),
        ("Pompes explosives", "Pectoraux"),
        ("Clap push-ups", "Pectoraux"),
        ("One-arm push-up", "Pectoraux"),
        ("One-arm push-up assistée", "Pectoraux"),
        ("Dips", "Triceps"),
        ("Dips lestés", "Triceps"),
        ("Dips sur banc", "Triceps"),
        ("Bench dips", "Triceps"),
        ("Extensions triceps au poids du corps", "Triceps"),
        ("Tractions pronation", "Dos"),
        ("Tractions supination", "Dos"),
        ("Tractions prise neutre", "Dos"),
        ("Tractions larges", "Dos"),
        ("Tractions serrées", "Dos"),
        ("Tractions archer", "Dos"),
        ("Tractions explosives", "Dos"),
        ("Chest-to-bar pull-up", "Dos"),
        ("Commando pull-up", "Dos"),
        ("Typewriter pull-up", "Dos"),
        ("Muscle-up", "Dos"),
        ("Muscle-up strict", "Dos"),
        ("Muscle-up explosif", "Dos"),
        ("Australian pull-up", "Dos"),
        ("Australian pull-up pieds surélevés", "Dos"),
        ("Scapular pull-up", "Dos"),
        ("Dead hang", "Dos"),
        ("Active hang", "Dos"),
        ("Skin the cat", "Épaules"),
        ("Front lever tuck", "Dos"),
        ("Advanced tuck front lever", "Dos"),
        ("Straddle front lever", "Dos"),
        ("Front lever", "Dos"),
        ("Front lever raises", "Dos"),
        ("Front lever pulls", "Dos"),
        ("Back lever tuck", "Dos"),
        ("Advanced tuck back lever", "Dos"),
        ("Straddle back lever", "Dos"),
        ("Back lever", "Dos"),
        ("Handstand", "Épaules"),
        ("Handstand hold", "Épaules"),
        ("Wall handstand", "Épaules"),
        ("Handstand shoulder taps", "Épaules"),
        ("Handstand push-up", "Épaules"),
        ("Handstand push-up assisté", "Épaules"),
        ("Pike push-up", "Épaules"),
        ("Elevated pike push-up", "Épaules"),
        ("Pseudo planche lean", "Épaules"),
        ("Planche tuck", "Épaules"),
        ("Advanced tuck planche", "Épaules"),
        ("Straddle planche", "Épaules"),
        ("Planche", "Épaules"),
        ("Planche lean", "Épaules"),
        ("L-sit", "Abdominaux"),
        ("Tuck L-sit", "Abdominaux"),
        ("Advanced tuck L-sit", "Abdominaux"),
        ("L-sit raises", "Abdominaux"),
        ("V-sit", "Abdominaux"),
        ("V-sit progression", "Abdominaux"),
        ("Hanging knee raises", "Abdominaux"),
        ("Hanging leg raises", "Abdominaux"),
        ("Toes-to-bar", "Abdominaux"),
        ("Strict toes-to-bar", "Abdominaux"),
        ("Knees-to-elbows", "Abdominaux"),
        ("Dragon flag", "Abdominaux"),
        ("Dragon flag négatif", "Abdominaux"),
        ("Hollow body hold", "Abdominaux"),
        ("Hollow rocks", "Abdominaux"),
        ("Arch body hold", "Abdominaux"),
        ("Arch rocks", "Abdominaux"),
        ("Plank", "Abdominaux"),
        ("Side plank", "Abdominaux"),
        ("RKC plank", "Abdominaux"),
        ("Reverse plank", "Abdominaux"),
        ("Mountain climbers", "Abdominaux"),
        ("Pistol squat", "Jambes"),
        ("Pistol squat assisté", "Jambes"),
        ("Shrimp squat", "Jambes"),
        ("Cossack squat", "Jambes"),
        ("Sissy squat", "Jambes"),
        ("Squat au poids du corps", "Jambes"),
        ("Squat jump", "Jambes"),
        ("Split squat", "Jambes"),
        ("Bulgarian split squat", "Jambes"),
        ("Fentes avant", "Jambes"),
        ("Fentes arrière", "Jambes"),
        ("Fentes marchées", "Jambes"),
        ("Nordic hamstring curl", "Ischio-jambiers"),
        ("Nordic curl assisté", "Ischio-jambiers"),
        ("Glute bridge", "Fessiers"),
        ("Single-leg glute bridge", "Fessiers"),
        ("Hip thrust au poids du corps", "Fessiers"),
        ("Single-leg calf raise", "Mollets"),
        ("Calf raise", "Mollets"),
        ("Box jump", "Jambes"),
        ("Broad jump", "Jambes"),
        ("Burpees", "Full body"),
        ("Burpee pull-up", "Full body"),
        ("Muscle-up transition", "Full body"),
        ("Handstand kick-up", "Épaules"),
        ("Handstand walk", "Épaules"),
        ("Handstand press", "Épaules"),
        ("Press to handstand", "Épaules"),
        ("Tuck press to handstand", "Épaules"),
        ("Human flag", "Abdominaux"),
        ("Human flag tuck", "Abdominaux"),
        ("Human flag progression", "Abdominaux"),
        ("One-arm pull-up progression", "Dos"),
        ("One-arm pull-up assistée", "Dos"),
        ("One-arm chin-up progression", "Dos"),
        ("Impossible dip", "Triceps"),
        ("Korean dip", "Triceps"),
        ("Tiger bend", "Triceps"),
        ("90 degree hold", "Épaules"),
        ("Maltese lean", "Épaules"),
        ("Maltese progression", "Épaules"),
        ("Victorian progression", "Dos"),
        ("Inverted hang", "Dos"),
        ("Hanging windshield wipers", "Abdominaux"),
        ("Windshield wipers", "Abdominaux"),
        ("Bar L-sit", "Abdominaux"),
        ("Ring L-sit", "Abdominaux"),
        ("Ring push-up", "Pectoraux"),
        ("Ring dip", "Triceps"),
        ("Ring pull-up", "Dos"),
        ("Ring muscle-up", "Dos"),
        ("Ring row", "Dos"),
        ("Ring support hold", "Épaules"),
        ("Ring push-up archer", "Pectoraux"),
        ("Support hold", "Épaules"),
        ("Top support", "Épaules"),
        ("Tuck hold", "Abdominaux"),
        ("Compression hold", "Abdominaux"),
        ("Seated leg lift", "Abdominaux"),
        ("Reverse Nordic curl", "Quadriceps"),
        ("Calf raise unilatéral", "Mollets"),
        ("Wall sit", "Jambes"),
        ("Bear crawl", "Full body"),
        ("Crab walk", "Full body"),
        ("Inchworm", "Full body"),
        ("Spiderman push-up", "Pectoraux"),
        ("Hindu squat", "Jambes"),
        ("Jumping lunges", "Jambes"),
    ]

    # Synchronisation du catalogue : les lignes historiques restent disponibles
    # pour l'historique, mais seules les lignes du catalogue canonique sont actives.
    cursor.execute("UPDATE exercices SET actif = 0")

    for nom, groupe in exercices_gym:
        existe = cursor.execute(
            "SELECT id FROM exercices WHERE nom = ? AND categorie = 'gym'",
            (nom,),
        ).fetchone()

        if existe:
            cursor.execute(
                """
                UPDATE exercices
                SET groupe_musculaire = ?, categorie = 'gym', actif = 1
                WHERE id = ?
                """,
                (groupe, existe[0]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO exercices
                (nom, groupe_musculaire, categorie, actif)
                VALUES (?, ?, 'gym', 1)
                """,
                (nom, groupe),
            )

    # Les anciennes lignes sans catégorie sont conservées pour l'historique
    # mais ne sont plus proposées dans le catalogue actif.
    cursor.execute(
        "UPDATE exercices SET categorie = 'gym' WHERE categorie IS NULL OR categorie = ''"
    )

    for nom, groupe in exercices_calisthenics:
        existe = cursor.execute(
            "SELECT id FROM exercices WHERE nom = ? AND categorie = 'calisthenics'",
            (nom,),
        ).fetchone()

        if existe:
            cursor.execute(
                """
                UPDATE exercices
                SET groupe_musculaire = ?, categorie = 'calisthenics', actif = 1
                WHERE id = ?
                """,
                (groupe, existe[0]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO exercices
                (nom, groupe_musculaire, categorie, actif)
                VALUES (?, ?, 'calisthenics', 1)
                """,
                (nom, groupe),
            )

    conn.commit()
    conn.close()


assurer_base()


# ============================================================
# AUTH - CREATION DE COMPTE
# ============================================================

@app.route("/auth/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    nom = str(data.get("nom", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    # Validation du nom
    if not nom:
        return jsonify({
            "error": "Le nom est obligatoire"
        }), 400

    if len(nom) > 100:
        return jsonify({
            "error": "Le nom est trop long"
        }), 400

    # Validation email
    if not email:
        return jsonify({
            "error": "L'email est obligatoire"
        }), 400

    if not email_valide(email):
        return jsonify({
            "error": "Adresse email invalide"
        }), 400

    # Validation mot de passe
    if len(password) < 8:
        return jsonify({
            "error": "Le mot de passe doit contenir au moins 8 caractères"
        }), 400

    if len(password) > 256:
        return jsonify({
            "error": "Le mot de passe est trop long"
        }), 400

    conn = get_db()

    # Vérifier si email déjà utilisé
    utilisateur_existant = conn.execute(
        """
        SELECT id
        FROM users
        WHERE email = ?
        """,
        (email,),
    ).fetchone()

    if utilisateur_existant:
        conn.close()

        return jsonify({
            "error": "Cette adresse email est déjà utilisée"
        }), 409

    # Créer le hash du mot de passe
    password_hash = hash_password(password)

    date_creation = datetime.now().isoformat()

    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO users
        (nom, email, password_hash, date_creation)
        VALUES (?, ?, ?, ?)
        """,
        (
            nom,
            email,
            password_hash,
            date_creation,
        ),
    )

    user_id = cursor.lastrowid

    # Création du token de connexion
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)

    cursor.execute(
        """
        INSERT INTO sessions
        (token_hash, user_id, date_creation, date_expiration)
        VALUES (?, ?, ?, ?)
        """,
        (
            token_hash,
            user_id,
            date_creation,
            (datetime.now() + timedelta(days=SESSION_DURATION_DAYS)).isoformat(),
        ),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Compte créé avec succès",
        "token": token,
        "user": {
            "id": user_id,
            "nom": nom,
            "email": email,
            "date_creation": date_creation,
        },
    }), 201


# ============================================================
# AUTH - CONNEXION
# ============================================================

@app.route("/auth/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({
            "error": "Email et mot de passe obligatoires"
        }), 400

    conn = get_db()

    user = conn.execute(
        """
        SELECT id, nom, email, password_hash, date_creation
        FROM users
        WHERE email = ?
        """,
        (email,),
    ).fetchone()

    if not user:
        conn.close()

        return jsonify({
            "error": "Email ou mot de passe incorrect"
        }), 401

    if not verify_password(
        password,
        user["password_hash"],
    ):
        conn.close()

        return jsonify({
            "error": "Email ou mot de passe incorrect"
        }), 401

    # Nouveau token de session
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    date_creation = datetime.now().isoformat()
    date_expiration = (
        datetime.now() + timedelta(days=SESSION_DURATION_DAYS)
    ).isoformat()

    conn.execute(
        """
        INSERT INTO sessions
        (token_hash, user_id, date_creation, date_expiration)
        VALUES (?, ?, ?, ?)
        """,
        (
            token_hash,
            user["id"],
            date_creation,
            date_expiration,
        ),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Connexion réussie",
        "token": token,
        "user": {
            "id": user["id"],
            "nom": user["nom"],
            "email": user["email"],
            "date_creation": user["date_creation"],
        },
    })


# ============================================================
# AUTH - UTILISATEUR CONNECTE
# ============================================================

@app.route("/auth/me")
def me():

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    return jsonify({
        "user": {
            "id": user["id"],
            "nom": user["nom"],
            "email": user["email"],
            "date_creation": user["date_creation"],
        }
    })


# ============================================================
# AUTH - DECONNEXION
# ============================================================

@app.route("/auth/logout", methods=["POST"])
def logout():

    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith("Bearer "):
        return jsonify({
            "message": "Déconnexion réussie"
        })

    token = authorization[7:].strip()

    if token:
        token_hash = hash_token(token)

        conn = get_db()

        conn.execute(
            """
            DELETE FROM sessions
            WHERE token_hash = ?
            """,
            (token_hash,),
        )

        conn.commit()
        conn.close()

    return jsonify({
        "message": "Déconnexion réussie"
    })


# ============================================================
# EXERCICES
# ============================================================

@app.route("/exercices")
def liste_exercices():

    conn = get_db()

    categorie = request.args.get("categorie", "all").strip().lower()

    if categorie not in ("gym", "calisthenics", "all"):
        categorie = "all"

    if categorie == "all":
        exercices = conn.execute(
            """
            SELECT *
            FROM exercices
            WHERE actif = 1
            ORDER BY id ASC
            """
        ).fetchall()
    else:
        exercices = conn.execute(
            """
            SELECT *
            FROM exercices
            WHERE categorie = ?
              AND actif = 1
            ORDER BY id ASC
            """,
            (categorie,),
        ).fetchall()

    conn.close()

    return jsonify([
        dict(exercice)
        for exercice in exercices
    ])


# ============================================================
# SEANCE - CREER
# ============================================================

@app.route("/seances", methods=["POST"])
def demarrer_seance():

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    active = conn.execute(
        """
        SELECT id, date_debut
        FROM seances
        WHERE user_id = ?
          AND date_fin IS NULL
        ORDER BY date_debut DESC
        LIMIT 1
        """,
        (user["id"],),
    ).fetchone()

    if active:
        conn.close()
        return jsonify({
            "seance_id": active["id"],
            "reused": True,
            "date_debut": active["date_debut"],
        })

    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO seances
            (date_debut, user_id)
            VALUES (?, ?)
            """,
            (
                datetime.now().isoformat(),
                user["id"],
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        active = conn.execute(
            """
            SELECT id, date_debut
            FROM seances
            WHERE user_id = ?
              AND date_fin IS NULL
            ORDER BY date_debut DESC
            LIMIT 1
            """,
            (user["id"],),
        ).fetchone()
        conn.close()

        if active:
            return jsonify({
                "seance_id": active["id"],
                "reused": True,
                "date_debut": active["date_debut"],
            })

        raise

    seance_id = cursor.lastrowid
    date_debut = cursor.execute(
        "SELECT date_debut FROM seances WHERE id = ?",
        (seance_id,),
    ).fetchone()[0]

    conn.close()

    return jsonify({
        "seance_id": seance_id,
        "reused": False,
        "date_debut": date_debut,
    }), 201


@app.route("/seances/active")
def seance_active():

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    seance = conn.execute(
        """
        SELECT id, date_debut
        FROM seances
        WHERE user_id = ?
          AND date_fin IS NULL
        ORDER BY date_debut DESC
        LIMIT 1
        """,
        (user["id"],),
    ).fetchone()

    if not seance:
        conn.close()
        return jsonify({"seance": None})

    # Compatibilité avec les séances actives créées avant la migration :
    # les exercices déjà présents via leurs séries deviennent automatiquement
    # des exercices de séance persistés.
    anciens_exercices = conn.execute(
        """
        SELECT exercice_id
        FROM series
        WHERE seance_id = ?
        GROUP BY exercice_id
        ORDER BY MIN(id) ASC
        """,
        (seance["id"],),
    ).fetchall()

    for ancien in anciens_exercices:
        present = conn.execute(
            """
            SELECT 1
            FROM seance_exercices
            WHERE seance_id = ? AND exercice_id = ?
            """,
            (seance["id"], ancien["exercice_id"]),
        ).fetchone()

        if not present:
            position = conn.execute(
                """
                SELECT COALESCE(MAX(position), -1) + 1
                FROM seance_exercices
                WHERE seance_id = ?
                """,
                (seance["id"],),
            ).fetchone()[0]

            conn.execute(
                """
                INSERT INTO seance_exercices
                (seance_id, exercice_id, position, date_ajout)
                VALUES (?, ?, ?, ?)
                """,
                (
                    seance["id"],
                    ancien["exercice_id"],
                    position,
                    datetime.now().isoformat(),
                ),
            )

    conn.commit()

    exercices = conn.execute(
        """
        SELECT
            seance_exercices.exercice_id,
            seance_exercices.position,
            exercices.nom,
            exercices.groupe_musculaire,
            exercices.categorie
        FROM seance_exercices
        JOIN exercices
            ON exercices.id = seance_exercices.exercice_id
        WHERE seance_exercices.seance_id = ?
        ORDER BY seance_exercices.position ASC, seance_exercices.id ASC
        """,
        (seance["id"],),
    ).fetchall()

    series = conn.execute(
        """
        SELECT
            series.id,
            series.exercice_id,
            exercices.nom AS exercice_nom,
            exercices.groupe_musculaire,
            series.poids,
            series.repetitions
        FROM series
        JOIN exercices
            ON exercices.id = series.exercice_id
        WHERE series.seance_id = ?
        ORDER BY series.id ASC
        """,
        (seance["id"],),
    ).fetchall()

    conn.close()

    return jsonify({
        "seance": {
            "id": seance["id"],
            "date_debut": seance["date_debut"],
            "exercices": [dict(exercice) for exercice in exercices],
            "series": [dict(serie) for serie in series],
        }
    })


# ============================================================
# VERIFICATION PROPRIETAIRE D'UNE SEANCE
# ============================================================

def verifier_proprietaire_seance(conn, seance_id, user_id):

    seance = conn.execute(
        """
        SELECT *
        FROM seances
        WHERE id = ?
          AND user_id = ?
        """,
        (
            seance_id,
            user_id,
        ),
    ).fetchone()

    return seance


# ============================================================
# SEANCE - AJOUTER UN EXERCICE
# ============================================================

@app.route(
    "/seances/<int:seance_id>/exercices",
    methods=["POST"],
)
def ajouter_exercice_a_seance(seance_id):

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    data = request.get_json(silent=True) or {}

    try:
        exercice_id = int(data.get("exercice_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "exercice_id invalide"}), 400

    conn = get_db()

    seance = conn.execute(
        """
        SELECT id
        FROM seances
        WHERE id = ?
          AND user_id = ?
          AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()
        return jsonify({"error": "Séance introuvable"}), 404

    exercice = conn.execute(
        """
        SELECT id, nom, groupe_musculaire, categorie
        FROM exercices
        WHERE id = ? AND actif = 1
        """,
        (exercice_id,),
    ).fetchone()

    if not exercice:
        conn.close()
        return jsonify({"error": "Exercice introuvable"}), 404

    present = conn.execute(
        """
        SELECT 1 FROM seance_exercices
        WHERE seance_id = ? AND exercice_id = ?
        """,
        (seance_id, exercice_id),
    ).fetchone()

    if present:
        conn.close()
        return jsonify({"error": "Exercice déjà présent dans la séance"}), 409

    position = conn.execute(
        """
        SELECT COALESCE(MAX(position), -1) + 1
        FROM seance_exercices
        WHERE seance_id = ?
        """,
        (seance_id,),
    ).fetchone()[0]

    conn.execute(
        """
        INSERT INTO seance_exercices
        (seance_id, exercice_id, position, date_ajout)
        VALUES (?, ?, ?, ?)
        """,
        (seance_id, exercice_id, position, datetime.now().isoformat()),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "status": "ok",
        "exercice": dict(exercice),
        "position": position,
    }), 201


# ============================================================
# SEANCE - SUPPRIMER UN EXERCICE
# ============================================================

@app.route(
    "/seances/<int:seance_id>/exercices/reorder",
    methods=["PUT"],
)
def reorganiser_exercices(seance_id):
    user = get_user_from_request()
    if not user:
        return utilisateur_non_connecte()

    data = request.get_json(silent=True) or {}
    exercice_ids = data.get("exercice_ids")

    if not isinstance(exercice_ids, list) or not exercice_ids:
        return jsonify({"error": "exercice_ids doit être une liste non vide"}), 400

    try:
        exercice_ids = [int(value) for value in exercice_ids]
    except (TypeError, ValueError):
        return jsonify({"error": "Identifiants d'exercices invalides"}), 400

    if len(set(exercice_ids)) != len(exercice_ids):
        return jsonify({"error": "Un exercice ne peut apparaître qu'une fois"}), 400

    conn = get_db()
    seance = conn.execute(
        """
        SELECT id FROM seances
        WHERE id = ? AND user_id = ? AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()
        return jsonify({"error": "Séance introuvable"}), 404

    membres = conn.execute(
        "SELECT exercice_id FROM seance_exercices WHERE seance_id = ?",
        (seance_id,),
    ).fetchall()
    membres_ids = {row["exercice_id"] for row in membres}

    if set(exercice_ids) != membres_ids:
        conn.close()
        return jsonify({"error": "La liste ne correspond pas aux exercices de la séance"}), 400

    for position, exercice_id in enumerate(exercice_ids):
        conn.execute(
            """
            UPDATE seance_exercices
            SET position = ?
            WHERE seance_id = ? AND exercice_id = ?
            """,
            (position, seance_id, exercice_id),
        )

    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@app.route(
    "/seances/<int:seance_id>/exercices/<int:exercice_id>",
    methods=["DELETE"],
)
def supprimer_exercice_de_seance(seance_id, exercice_id):

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    seance = conn.execute(
        """
        SELECT id
        FROM seances
        WHERE id = ?
          AND user_id = ?
          AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()
        return jsonify({"error": "Séance introuvable"}), 404

    present = conn.execute(
        """
        SELECT id FROM seance_exercices
        WHERE seance_id = ? AND exercice_id = ?
        """,
        (seance_id, exercice_id),
    ).fetchone()

    if not present:
        conn.close()
        return jsonify({"error": "Exercice absent de la séance"}), 404

    conn.execute(
        """
        DELETE FROM seance_exercices
        WHERE seance_id = ? AND exercice_id = ?
        """,
        (seance_id, exercice_id),
    )

    conn.execute(
        """
        DELETE FROM series
        WHERE seance_id = ? AND exercice_id = ?
        """,
        (seance_id, exercice_id),
    )

    restantes = conn.execute(
        """
        SELECT id FROM seance_exercices
        WHERE seance_id = ?
        ORDER BY position ASC, id ASC
        """,
        (seance_id,),
    ).fetchall()

    for position, ligne in enumerate(restantes):
        conn.execute(
            "UPDATE seance_exercices SET position = ? WHERE id = ?",
            (position, ligne["id"]),
        )

    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})


# ============================================================
# SEANCE - AJOUTER UNE SERIE
# ============================================================

@app.route(
    "/seances/<int:seance_id>/series",
    methods=["POST"],
)
def ajouter_serie(seance_id):

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    data = request.get_json(silent=True) or {}

    exercice_id = data.get("exercice_id")
    poids = data.get("poids")
    repetitions = data.get("repetitions")

    if exercice_id is None:
        return jsonify({
            "error": "exercice_id obligatoire"
        }), 400

    if repetitions is None:
        return jsonify({
            "error": "repetitions obligatoires"
        }), 400

    try:
        poids_numerique = float(poids) if poids is not None and poids != "" else 0.0
        repetitions_numeriques = int(repetitions)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Poids ou répétitions invalides"
        }), 400

    if poids_numerique < 0:
        return jsonify({
            "error": "Le poids ne peut pas être négatif"
        }), 400

    if repetitions_numeriques < 1:
        return jsonify({
            "error": "Les répétitions doivent être supérieures à 0"
        }), 400

    conn = get_db()

    # Vérifier que la séance appartient bien
    # à l'utilisateur connecté
    seance = conn.execute(
        """
        SELECT *
        FROM seances
        WHERE id = ?
          AND user_id = ?
          AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()

        return jsonify({
            "error": "Séance introuvable"
        }), 404

    # Vérifier que l'exercice existe
    exercice = conn.execute(
        """
        SELECT id
        FROM exercices
        WHERE id = ?
          AND actif = 1
        """,
        (exercice_id,),
    ).fetchone()

    if not exercice:
        conn.close()

        return jsonify({
            "error": "Exercice introuvable"
        }), 404

    cursor = conn.cursor()

    membership = conn.execute(
        """
        SELECT 1 FROM seance_exercices
        WHERE seance_id = ? AND exercice_id = ?
        """,
        (seance_id, exercice_id),
    ).fetchone()

    if not membership:
        position = conn.execute(
            """
            SELECT COALESCE(MAX(position), -1) + 1
            FROM seance_exercices
            WHERE seance_id = ?
            """,
            (seance_id,),
        ).fetchone()[0]

        conn.execute(
            """
            INSERT INTO seance_exercices
            (seance_id, exercice_id, position, date_ajout)
            VALUES (?, ?, ?, ?)
            """,
            (seance_id, exercice_id, position, datetime.now().isoformat()),
        )

    cursor.execute(
        """
        INSERT INTO series
        (
            seance_id,
            exercice_id,
            poids,
            repetitions
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            seance_id,
            exercice_id,
            poids_numerique,
            repetitions_numeriques,
        ),
    )

    series_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "ok",
        "series_id": series_id,
    }), 201


# ============================================================
# SEANCE - SUPPRIMER UNE SERIE
# ============================================================

@app.route(
    "/seances/<int:seance_id>/series/<int:series_id>",
    methods=["DELETE"],
)
def supprimer_serie(seance_id, series_id):
    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()
    seance = conn.execute(
        """
        SELECT *
        FROM seances
        WHERE id = ?
          AND user_id = ?
          AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()
        return jsonify({"error": "Séance introuvable"}), 404

    serie = conn.execute(
        "SELECT id FROM series WHERE id = ? AND seance_id = ?",
        (series_id, seance_id),
    ).fetchone()

    if not serie:
        conn.close()
        return jsonify({"error": "Série introuvable"}), 404

    conn.execute(
        "DELETE FROM series WHERE id = ? AND seance_id = ?",
        (series_id, seance_id),
    )
    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})


# ============================================================
# SEANCE - TERMINER
# ============================================================

@app.route(
    "/seances/<int:seance_id>/terminer",
    methods=["POST"],
)
def terminer_seance(seance_id):

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    seance = conn.execute(
        """
        SELECT *
        FROM seances
        WHERE id = ?
          AND user_id = ?
          AND date_fin IS NULL
        """,
        (seance_id, user["id"]),
    ).fetchone()

    if not seance:
        conn.close()

        return jsonify({
            "error": "Séance introuvable"
        }), 404

    conn.execute(
        """
        UPDATE seances
        SET date_fin = ?
        WHERE id = ?
          AND user_id = ?
        """,
        (
            datetime.now().isoformat(),
            seance_id,
            user["id"],
        ),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "status": "séance terminée"
    })


# ============================================================
# PREVIOUS
# ============================================================

@app.route(
    "/exercices/<int:exercice_id>/previous"
)
def previous_exercice(exercice_id):

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    seance = conn.execute(
        """
        SELECT seances.id
        FROM seances
        JOIN series
            ON series.seance_id = seances.id
        WHERE series.exercice_id = ?
          AND seances.date_fin IS NOT NULL
          AND seances.user_id = ?
        ORDER BY seances.date_debut DESC
        LIMIT 1
        """,
        (
            exercice_id,
            user["id"],
        ),
    ).fetchone()

    if not seance:
        conn.close()

        return jsonify([])

    series = conn.execute(
        """
        SELECT
            id,
            poids,
            repetitions
        FROM series
        WHERE seance_id = ?
          AND exercice_id = ?
        ORDER BY id ASC
        """,
        (
            seance["id"],
            exercice_id,
        ),
    ).fetchall()

    conn.close()

    return jsonify([
        {
            "poids": serie["poids"],
            "repetitions": serie["repetitions"],
        }
        for serie in series
    ])


# ============================================================
# HISTORIQUE
# ============================================================

@app.route("/historique")
def historique():

    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    seances = conn.execute(
        """
        SELECT *
        FROM seances
        WHERE date_fin IS NOT NULL
          AND user_id = ?
        ORDER BY date_debut DESC
        """,
        (user["id"],),
    ).fetchall()

    resultat = []

    for seance in seances:

        series = conn.execute(
            """
            SELECT
                series.*,
                exercices.nom AS exercice_nom
            FROM series
            JOIN exercices
                ON series.exercice_id = exercices.id
            WHERE series.seance_id = ?
            ORDER BY series.id ASC
            """,
            (seance["id"],),
        ).fetchall()

        resultat.append({
            "id": seance["id"],
            "date_debut": seance["date_debut"],
            "date_fin": seance["date_fin"],
            "series": [
                dict(serie)
                for serie in series
            ],
        })

    conn.close()

    return jsonify(resultat)


# ============================================================
# PROGRESSION
# ============================================================

@app.route("/progression")
def progression():
    user = get_user_from_request()

    if not user:
        return utilisateur_non_connecte()

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            exercices.id AS exercice_id,
            exercices.nom AS exercice_nom,
            exercices.groupe_musculaire,
            COUNT(series.id) AS total_series,
            COUNT(DISTINCT seances.id) AS total_seances,
            MAX(series.poids) AS meilleur_poids,
            MAX(series.repetitions) AS meilleures_repetitions,
            MAX(series.poids * series.repetitions) AS meilleure_serie,
            COALESCE(SUM(series.poids * series.repetitions), 0) AS volume_total
        FROM series
        JOIN exercices ON exercices.id = series.exercice_id
        JOIN seances ON seances.id = series.seance_id
        WHERE seances.user_id = ?
          AND seances.date_fin IS NOT NULL
        GROUP BY exercices.id, exercices.nom, exercices.groupe_musculaire
        ORDER BY volume_total DESC, exercices.nom ASC
        """,
        (user["id"],),
    ).fetchall()

    progression_resultat = []

    for row in rows:
        historique = conn.execute(
            """
            SELECT
                seances.date_debut,
                MAX(series.poids) AS poids_max,
                MAX(series.repetitions) AS repetitions_max,
                COALESCE(SUM(series.poids * series.repetitions), 0) AS volume
            FROM series
            JOIN seances ON seances.id = series.seance_id
            WHERE series.exercice_id = ?
              AND seances.user_id = ?
              AND seances.date_fin IS NOT NULL
            GROUP BY seances.id, seances.date_debut
            ORDER BY seances.date_debut DESC
            LIMIT 10
            """,
            (row["exercice_id"], user["id"]),
        ).fetchall()

        progression_resultat.append({
            "exercice_id": row["exercice_id"],
            "exercice_nom": row["exercice_nom"],
            "groupe_musculaire": row["groupe_musculaire"],
            "total_series": row["total_series"],
            "total_seances": row["total_seances"],
            "meilleur_poids": row["meilleur_poids"],
            "meilleures_repetitions": row["meilleures_repetitions"],
            "meilleure_serie": row["meilleure_serie"],
            "volume_total": row["volume_total"],
            "historique": [dict(item) for item in historique],
        })

    conn.close()

    return jsonify(progression_resultat)


# ============================================================
# LANCEMENT
# ============================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        debug=False,
        port=5001,
    )