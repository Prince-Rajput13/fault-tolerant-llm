"""POST /chat – conversational LLM endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Header
from typing import Optional

from app import config
from app.db import (
    get_messages,
    get_session_prompt,
    upsert_session_prompt,
    add_message,
)
from app.llm_gateway import chat_completion, AllProvidersUnavailable
from app.schemas import ChatRequest, ChatResponse, ChatMetadata

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
):
    session_id = body.session_id
    user_message = body.message  # already trimmed by validator

    # --- Resolve system prompt ---
    system_prompt: str
    if body.system_prompt is not None:
        system_prompt = body.system_prompt
        await upsert_session_prompt(session_id, system_prompt)
    else:
        stored = await get_session_prompt(session_id)
        system_prompt = stored if stored is not None else config.settings.default_system_prompt

    # --- Build the LLM message list ---
    history = await get_messages(session_id)
    llm_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        llm_messages.append({"role": msg["role"], "content": msg["content"]})
    llm_messages.append({"role": "user", "content": user_message})

    # --- Call the LLM gateway ---
    result = await chat_completion(
        llm_messages,
        simulate_header=x_simulate_failure,
    )

    # --- Persist BOTH user and assistant messages on success ---
    await add_message(session_id, "user", user_message)

    assistant_meta = {
        "resolution_source": result.resolution_source,
        "model": result.model,
        "latency_ms": result.latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "key_id": result.key_id,
        "fallback_attempts": result.fallback_attempts,
    }
    await add_message(session_id, "assistant", result.reply, metadata=assistant_meta)

    return ChatResponse(
        session_id=session_id,
        reply=result.reply,
        metadata=ChatMetadata(**assistant_meta),
    )
