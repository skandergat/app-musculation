from flask import Flask, jsonify, request
import sqlite3
from datetime import datetime
import hashlib
import secrets
import re

app = Flask(__name__)

DB_PATH = "musculation.db"


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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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

    user = conn.execute(
        """
        SELECT users.id, users.nom, users.email, users.date_creation
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        """,
        (token_hash,),
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
            groupe_musculaire TEXT
        )
    """)

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
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

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
    # EXERCICES DE BASE
    # --------------------------------------------------------

    cursor.execute("SELECT COUNT(*) FROM exercices")

    if cursor.fetchone()[0] == 0:

        exercices_de_base = [
            ("Développé couché", "Pectoraux"),
            ("Développé incliné haltères", "Pectoraux"),
            ("Pompes", "Pectoraux"),
            ("Squat", "Jambes"),
            ("Presse à cuisses", "Jambes"),
            ("Fentes", "Jambes"),
            ("Soulevé de terre", "Dos"),
            ("Tractions", "Dos"),
            ("Rowing barre", "Dos"),
            ("Tirage vertical", "Dos"),
            ("Développé militaire", "Épaules"),
            ("Élévations latérales", "Épaules"),
            ("Curl biceps barre", "Biceps"),
            ("Curl biceps haltères", "Biceps"),
            ("Extensions triceps poulie", "Triceps"),
            ("Dips", "Triceps"),
            ("Crunch", "Abdominaux"),
            ("Planche", "Abdominaux"),
            ("Mollets debout", "Mollets"),
            ("Hip thrust", "Fessiers"),
        ]

        cursor.executemany(
            """
            INSERT INTO exercices
            (nom, groupe_musculaire)
            VALUES (?, ?)
            """,
            exercices_de_base,
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
        (token_hash, user_id, date_creation)
        VALUES (?, ?, ?)
        """,
        (
            token_hash,
            user_id,
            date_creation,
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

    conn.execute(
        """
        INSERT INTO sessions
        (token_hash, user_id, date_creation)
        VALUES (?, ?, ?)
        """,
        (
            token_hash,
            user["id"],
            datetime.now().isoformat(),
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

    exercices = conn.execute(
        """
        SELECT *
        FROM exercices
        ORDER BY id ASC
        """
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

    cursor = conn.cursor()

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

    seance_id = cursor.lastrowid

    conn.close()

    return jsonify({
        "seance_id": seance_id
    }), 201


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

    conn = get_db()

    # Vérifier que la séance appartient bien
    # à l'utilisateur connecté
    seance = verifier_proprietaire_seance(
        conn,
        seance_id,
        user["id"],
    )

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
        """,
        (exercice_id,),
    ).fetchone()

    if not exercice:
        conn.close()

        return jsonify({
            "error": "Exercice introuvable"
        }), 404

    conn.execute(
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
            poids,
            repetitions,
        ),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "status": "ok"
    }), 201


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

    seance = verifier_proprietaire_seance(
        conn,
        seance_id,
        user["id"],
    )

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
# LANCEMENT
# ============================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        debug=True,
        port=5001,
    )