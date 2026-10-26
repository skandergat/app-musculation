"""Small SQLite/PostgreSQL compatibility layer for LIFTELY."""
from __future__ import annotations
import os, re, sqlite3
from collections.abc import Mapping
import psycopg
from psycopg.rows import dict_row
from psycopg.pq import TransactionStatus

POSTGRES_DSN = os.environ.get("SUPABASE_DB_URL", "").strip() or os.environ.get("DATABASE_URL", "").strip()
POSTGRES_ENABLED = bool(POSTGRES_DSN)
INTEGRITY_ERRORS = (psycopg.IntegrityError,) if POSTGRES_ENABLED else (sqlite3.IntegrityError,)
_ID_TABLES = {"users", "exercices", "templates", "template_exercices", "seances", "series", "seance_exercices"}

class HybridRow(dict):
    def __init__(self, value):
        super().__init__(value)
        self._keys = tuple(value.keys())
    def __getitem__(self, key):
        if isinstance(key, int):
            key = self._keys[key]
        return super().__getitem__(key)

def _row(value):
    if value is None or isinstance(value, HybridRow):
        return value
    return HybridRow(value) if isinstance(value, Mapping) else value

class CursorAdapter:
    def __init__(self, cursor):
        self._cursor = cursor
        self._lastrowid = None
    @property
    def lastrowid(self):
        return self._lastrowid
    @property
    def description(self):
        return self._cursor.description
    def execute(self, sql, params=()):
        sql = sql.replace("BEGIN IMMEDIATE", "BEGIN").replace("?", "%s")
        match = re.match(r"\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)", sql, re.I)
        table = match.group(1).lower() if match else None
        add_returning = table in _ID_TABLES and not re.search(r"\bRETURNING\b", sql, re.I)
        if add_returning:
            sql = sql.rstrip().rstrip(";") + " RETURNING id"
        self._cursor.execute(sql, params)
        self._lastrowid = None
        if add_returning:
            row = self._cursor.fetchone()
            if row is not None:
                self._lastrowid = row["id"] if isinstance(row, Mapping) else row[0]
        return self
    def fetchone(self):
        return _row(self._cursor.fetchone())
    def fetchall(self):
        return [_row(row) for row in self._cursor.fetchall()]
    def fetchmany(self, size=None):
        rows = self._cursor.fetchmany() if size is None else self._cursor.fetchmany(size)
        return [_row(row) for row in rows]
    def __iter__(self):
        return iter(self.fetchall())

class ConnectionAdapter:
    def __init__(self, connection):
        self._connection = connection
    @property
    def in_transaction(self):
        return self._connection.info.transaction_status != TransactionStatus.IDLE
    def execute(self, sql, params=()):
        return CursorAdapter(self._connection.cursor()).execute(sql, params)
    def cursor(self):
        return CursorAdapter(self._connection.cursor())
    def commit(self):
        return self._connection.commit()
    def rollback(self):
        return self._connection.rollback()
    def close(self):
        return self._connection.close()

def connect_database(sqlite_path, timeout=10):
    if POSTGRES_ENABLED:
        return ConnectionAdapter(psycopg.connect(POSTGRES_DSN, connect_timeout=timeout, row_factory=dict_row))
    conn = sqlite3.connect(sqlite_path, timeout=timeout)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn
