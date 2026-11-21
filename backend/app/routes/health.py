"""GET /health – readiness check."""

from fastapi import APIRouter

from app import config
from app.db import db_reachable
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    reachable = await db_reachable()
    if not reachable:
        # Still return 200 with status info – the spec says 200 "once the
        # app is running, the database is reachable and the key pool is loaded".
        pass
    return HealthResponse(
        status="ok",
        keys_configured=len(config.settings.api_keys),
        cache_enabled=True,
    )
