"""GET /sessions/{session_id}/messages – retrieve conversation history."""

from fastapi import APIRouter, HTTPException

from app.db import get_messages, session_exists
from app.schemas import SessionMessagesResponse, MessageOut

router = APIRouter()


@router.get(
    "/sessions/{session_id}/messages",
    response_model=SessionMessagesResponse,
)
async def session_messages(session_id: str):
    exists = await session_exists(session_id)
    if not exists:
        raise HTTPException(status_code=404, detail="session not found")

    rows = await get_messages(session_id)
    messages = []
    for row in rows:
        meta = row.get("metadata")
        if meta and isinstance(meta, dict):
            # Only include the three spec-required fields (extra fields OK).
            meta_out = {
                "resolution_source": meta.get("resolution_source"),
                "input_tokens": meta.get("input_tokens"),
                "output_tokens": meta.get("output_tokens"),
            }
        else:
            meta_out = None
        messages.append(
            MessageOut(role=row["role"], content=row["content"], metadata=meta_out)
        )

    return SessionMessagesResponse(session_id=session_id, messages=messages)
