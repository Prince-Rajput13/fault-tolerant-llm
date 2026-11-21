"""Pydantic models for API request / response bodies."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import Optional


# ── Request ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str
    system_prompt: Optional[str] = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("message must not be blank after trimming whitespace")
        if len(trimmed) > 4000:
            raise ValueError("message must be at most 4000 characters after trimming")
        return trimmed


# ── Response ─────────────────────────────────────────────────────────────────

class ChatMetadata(BaseModel):
    resolution_source: str  # LIVE_INFERENCE | LLM_CACHE
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str]
    fallback_attempts: int


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    metadata: ChatMetadata


class HealthResponse(BaseModel):
    status: str
    keys_configured: int
    cache_enabled: bool


class MessageOut(BaseModel):
    role: str
    content: str
    metadata: Optional[dict] = None


class SessionMessagesResponse(BaseModel):
    session_id: str
    messages: list[MessageOut]
