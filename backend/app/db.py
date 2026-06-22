import sqlite3
from contextlib import contextmanager

from .config import DB_PATH


def create_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db_connection():
    connection = create_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with db_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS emergency_configs (
                user_id TEXT PRIMARY KEY,
                call_number TEXT,
                sms_number TEXT,
                sms_template TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tracking_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                accuracy REAL NOT NULL,
                speed REAL NOT NULL,
                heading REAL NOT NULL,
                timestamp_text TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sos_events (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                accuracy REAL NOT NULL,
                trigger_type TEXT NOT NULL,
                timestamp_text TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sos_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                destination TEXT,
                status TEXT NOT NULL,
                detail TEXT NOT NULL,
                FOREIGN KEY(event_id) REFERENCES sos_events(id) ON DELETE CASCADE
            );
            """
        )
