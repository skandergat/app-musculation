"""Initialize the application's SQLite database using the backend schema.

The canonical schema and exercise catalogue live in backend/app.py.
Running this script from the repository root uses the same database path
as the Flask development server.
"""

from backend.app import assurer_base


if __name__ == "__main__":
    assurer_base()
    print("Base de données initialisée avec succès (musculation.db).")
