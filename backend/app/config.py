"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """All backend configuration, loaded from env vars."""

    # --- LLM -----------------------------------------------------------------
    llm_api_keys: str = Field(
        default="",
        description="Comma-separated API keys. IDs are key_1, key_2, … in order.",
    )
    llm_model: str = Field(
        default="gemini/gemini-2.5-flash",
        description="LiteLLM model identifier.",
    )

    # --- Database -------------------------------------------------------------
    database_url: str = Field(
        default="sqlite:////data/app.db",
        description="SQLite connection string (sqlite:///path).",
    )

    # --- CORS -----------------------------------------------------------------
    allowed_origins: str = Field(
        default="*",
        description="Comma-separated allowed CORS origins.",
    )

    # --- Feature flags --------------------------------------------------------
    enable_failure_simulation: bool = Field(
        default=False,
        description="When true, honour the X-Simulate-Failure header.",
    )
    mock_completion: bool = Field(
        default=False,
        description="When true, simulate realistic LLM replies locally without outbound API calls.",
    )

    # --- Prompts --------------------------------------------------------------
    default_system_prompt: str = Field(
        default="You are a helpful assistant.",
        description="Default system prompt for new sessions.",
    )

    # --- Derived helpers (not env vars) ----------------------------------------
    @property
    def api_keys(self) -> list[str]:
        """Return the parsed list of API keys."""
        return [k.strip() for k in self.llm_api_keys.split(",") if k.strip()]

    @property
    def key_ids(self) -> list[str]:
        """Return deterministic key IDs: key_1, key_2, …"""
        return [f"key_{i + 1}" for i in range(len(self.api_keys))]

    @property
    def db_path(self) -> str:
        """Extract the filesystem path from the DATABASE_URL.

        Supports both ``sqlite:///path`` (3 slashes → relative) and
        ``sqlite:////path`` (4 slashes → absolute).
        """
        url = self.database_url
        if url.startswith("sqlite:///"):
            return url[len("sqlite:///"):]
        return url

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


# Module-level singleton – import this everywhere.
settings = Settings()
