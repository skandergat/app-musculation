from flask import Flask, jsonify, request
import sqlite3
from datetime import datetime

app = Flask(__name__)

DB_PATH = "musculation.db"


def assurer_base():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            groupe_musculaire TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS seances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_debut TEXT NOT NULL,
            date_fin TEXT
        )
    """)

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
            "INSERT INTO exercices (nom, groupe_musculaire) VALUES (?, ?)",
            exercices_de_base,
        )

    conn.commit()
    conn.close()


assurer_base()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/exercices")
def liste_exercices():
    conn = get_db()
    exercices = conn.execute("SELECT * FROM exercices").fetchall()
    conn.close()
    return jsonify([dict(e) for e in exercices])


@app.route("/seances", methods=["POST"])
def demarrer_seance():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO seances (date_debut) VALUES (?)",
        (datetime.now().isoformat(),),
    )
    conn.commit()
    seance_id = cursor.lastrowid
    conn.close()
    return jsonify({"seance_id": seance_id}), 201


@app.route("/seances/<int:seance_id>/series", methods=["POST"])
def ajouter_serie(seance_id):
    data = request.get_json()
    exercice_id = data.get("exercice_id")
    poids = data.get("poids")
    repetitions = data.get("repetitions")

    conn = get_db()
    conn.execute(
        "INSERT INTO series (seance_id, exercice_id, poids, repetitions) VALUES (?, ?, ?, ?)",
        (seance_id, exercice_id, poids, repetitions),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"}), 201


@app.route("/seances/<int:seance_id>/terminer", methods=["POST"])
def terminer_seance(seance_id):
    conn = get_db()
    conn.execute(
        "UPDATE seances SET date_fin = ? WHERE id = ?",
        (datetime.now().isoformat(), seance_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "séance terminée"})


@app.route("/historique")
def historique():
    conn = get_db()
    seances = conn.execute(
        "SELECT * FROM seances WHERE date_fin IS NOT NULL ORDER BY date_debut DESC"
    ).fetchall()
    resultat = []
    for s in seances:
        series = conn.execute(
            """SELECT series.*, exercices.nom as exercice_nom
               FROM series JOIN exercices ON series.exercice_id = exercices.id
               WHERE seance_id = ?""",
            (s["id"],),
        ).fetchall()
        resultat.append({
            "id": s["id"],
            "date_debut": s["date_debut"],
            "date_fin": s["date_fin"],
            "series": [dict(sr) for sr in series],
        })
    conn.close()
    return jsonify(resultat)


if __name__ == "__main__":
    app.run(debug=True)
    # Test GitHub automatique