"""FastAPI application entry point.

Responsibilities
----------------
*   Lifespan: initialise and close the database.
*   CORS middleware from ``ALLOWED_ORIGINS``.
*   Global exception handlers – **nothing** ever returns a stack trace or HTML.
*   Mount the three route modules.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.db import init_db, close_db
from app.llm_gateway import AllProvidersUnavailable
from app.routes import health, chat, sessions


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Fault-Tolerant LLM Chatbot", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(sessions.router)


# ── Exception handlers ──────────────────────────────────────────────────────

@app.exception_handler(AllProvidersUnavailable)
async def _all_providers_unavailable(request: Request, exc: AllProvidersUnavailable):
    return JSONResponse(
        status_code=503,
        content={"detail": "all providers unavailable"},
    )


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    # Sanitise errors: convert any non-serialisable 'ctx' values to strings.
    errors = []
    for err in exc.errors():
        clean = {k: v for k, v in err.items() if k != "ctx"}
        if "ctx" in err:
            clean["ctx"] = {k: str(v) for k, v in err["ctx"].items()}
        errors.append(clean)
    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )


@app.exception_handler(StarletteHTTPException)
async def _http_exception(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    # Never leak internals.
    return JSONResponse(
        status_code=500,
        content={"detail": "internal server error"},
    )
