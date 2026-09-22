import sqlite3

DB_PATH = "musculation.db"


def init_db():
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
        print(f"{len(exercices_de_base)} exercices ajoutés.")

    conn.commit()
    conn.close()
    print("Base de données initialisée avec succès (musculation.db).")


if __name__ == "__main__":
    init_db()