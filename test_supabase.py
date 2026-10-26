
import os
import psycopg

try:
    uri = os.environ.get("LIFTELY_SUPABASE_TEST_URL")
    if not uri:
        uri = input("Colle ton URI Session pooler Supabase (saisie locale) : ").strip()

    with psycopg.connect(
        uri,
        connect_timeout=10,
        sslmode="require",
        options="-c default_transaction_read_only=on",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), current_schema()")
            print("CONNEXION OK :", cur.fetchone())

            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            print("TABLES :", [row[0] for row in cur.fetchall()])

except Exception as e:
    print("ERREUR :", type(e).__name__, str(e))
