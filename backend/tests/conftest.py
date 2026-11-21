"""conftest.py – shared fixtures for backend tests."""

from __future__ import annotations

import os
# Ensure litellm does not make network calls for model prices or telemetry in offline / isolated environments
os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
os.environ["LITELLM_TELEMETRY"] = "False"

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

# Ensure the backend package is importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch):
    """Set required env vars before every test.

    Uses a fresh temp SQLite DB for isolation.
    """
    db_file = str(tmp_path / "test.db").replace("\\", "/")
    monkeypatch.setenv("LLM_API_KEYS", "fake-key-1,fake-key-2")
    monkeypatch.setenv("LLM_MODEL", "gemini/gemini-2.5-flash")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    monkeypatch.setenv("ENABLE_FAILURE_SIMULATION", "true")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT", "You are a test assistant.")

    # Update settings singleton
    from app import config
    config.settings = config.Settings()


@pytest.fixture
async def client(_env):
    """Yield an async httpx test client with the DB properly initialised."""
    from app import db, main

    # Initialise isolated DB for this test
    await db.init_db()

    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app, raise_app_exceptions=False),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        await db.close_db()
