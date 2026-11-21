"""SQLite database layer using aiosqlite (async, WAL mode)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

from app import config

# Module-level connection (set during lifespan).
_db: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    """Return the shared database connection."""
    assert _db is not None, "Database not initialised – call init_db() first."
    return _db


async def init_db() -> None:
    """Open the database, enable WAL, and create the schema."""
    global _db

    db_path = config.settings.db_path
    # Create parent directory if needed.
    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    _db = await aiosqlite.connect(db_path)
    _db.row_factory = aiosqlite.Row

    # WAL mode for concurrency.
    await _db.execute("PRAGMA journal_mode=WAL")

    # Schema ──────────────────────────────────────────────────────────────
    await _db.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            role        TEXT    NOT NULL,
            content     TEXT    NOT NULL,
            metadata    TEXT,
            created_at  TEXT    NOT NULL
        )
        """
    )
    await _db.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id    TEXT PRIMARY KEY,
            system_prompt TEXT NOT NULL
        )
        """
    )
    await _db.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id)"
    )
    await _db.commit()


async def close_db() -> None:
    """Close the database connection."""
    global _db
    if _db is not None:
        await _db.close()
        _db = None


# ── CRUD helpers ─────────────────────────────────────────────────────────────

async def get_session_prompt(session_id: str) -> Optional[str]:
    """Return the stored system prompt for a session, or None."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT system_prompt FROM sessions WHERE session_id = ?", (session_id,)
    )
    row = await cursor.fetchone()
    return row["system_prompt"] if row else None


async def upsert_session_prompt(session_id: str, prompt: str) -> None:
    """Create or update the system prompt for a session."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO sessions (session_id, system_prompt)
        VALUES (?, ?)
        ON CONFLICT(session_id) DO UPDATE SET system_prompt = excluded.system_prompt
        """,
        (session_id, prompt),
    )
    await db.commit()


async def get_messages(session_id: str) -> list[dict]:
    """Return all messages for a session, oldest first."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT role, content, metadata FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,),
    )
    rows = await cursor.fetchall()
    result = []
    for row in rows:
        entry: dict = {"role": row["role"], "content": row["content"]}
        if row["metadata"]:
            entry["metadata"] = json.loads(row["metadata"])
        result.append(entry)
    return result


async def session_exists(session_id: str) -> bool:
    """Check if any messages exist for a session."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT 1 FROM messages WHERE session_id = ? LIMIT 1", (session_id,)
    )
    return (await cursor.fetchone()) is not None


async def add_message(
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
) -> None:
    """Persist a single message."""
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    meta_json = json.dumps(metadata) if metadata else None
    await db.execute(
        "INSERT INTO messages (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
        (session_id, role, content, meta_json, now),
    )
    await db.commit()


async def db_reachable() -> bool:
    """Quick check that the database is accessible."""
    try:
        db = await get_db()
        await db.execute("SELECT 1")
        return True
    except Exception:
        return False
