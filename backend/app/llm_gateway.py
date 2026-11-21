"""LLM gateway: ordered key loop with LiteLLM caching.

Design
------
*   LiteLLM's built-in in-memory cache (``litellm.cache``) is enabled once
    at module load.
*   ``chat_completion`` iterates over configured keys in order. On
    retryable errors (429 / quota / 5xx / timeout / connection) it falls
    through to the next key and increments ``fallback_attempts``.
*   Cache hits are detected via ``response._hidden_params["cache_hit"]``.
*   ``X-Simulate-Failure`` support injects exceptions *before* calling the
    provider, per-request only, with no persistent cooldown.
"""

from __future__ import annotations

import logging
import os
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
os.environ.setdefault("LITELLM_TELEMETRY", "False")

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Optional

import litellm
from litellm import Cache
from litellm.exceptions import (
    RateLimitError,
    ServiceUnavailableError,
    InternalServerError,
    Timeout,
    APIConnectionError,
    NotFoundError,
    AuthenticationError,
    BadRequestError,
)
from app import config

litellm.drop_params = True

logger = logging.getLogger(__name__)

# ── Cache setup (runs once at import) ────────────────────────────────────────
litellm.cache = Cache(type="local")
litellm.enable_cache = True

# Suppress noisy litellm logs and telemetry.
litellm.suppress_debug_info = True
litellm.telemetry = False
litellm.turn_off_message_logging = True

# Request-level timeout in seconds.
_REQUEST_TIMEOUT = 30

# Valid simulated status codes.
_VALID_SIM_STATUSES = {429, 500, 502, 503}


# ── Custom exception ────────────────────────────────────────────────────────

class AllProvidersUnavailable(Exception):
    """Raised when every configured key has been exhausted."""


# ── Result container ────────────────────────────────────────────────────────

@dataclass
class LLMResult:
    reply: str
    resolution_source: str  # LIVE_INFERENCE | LLM_CACHE
    model: str
    input_tokens: int
    output_tokens: int
    key_id: Optional[str]
    fallback_attempts: int
    latency_ms: int


# ── Failure simulation parsing ───────────────────────────────────────────────

def _parse_simulation_header(header: Optional[str]) -> dict[str, int]:
    """Parse ``X-Simulate-Failure`` header value into {key_id_or_*: status}.

    Silently ignores malformed parts.
    """
    if not header:
        return {}
    result: dict[str, int] = {}
    for part in header.split(","):
        part = part.strip()
        if "=" not in part:
            continue
        key_part, _, status_part = part.partition("=")
        key_part = key_part.strip()
        status_part = status_part.strip()
        try:
            status = int(status_part)
        except ValueError:
            continue
        if status not in _VALID_SIM_STATUSES:
            continue
        result[key_part] = status
    return result


def _raise_simulated(status: int, key_id: str) -> None:
    """Raise the LiteLLM exception corresponding to *status*."""
    model = config.settings.llm_model
    exc: Exception
    if status == 429:
        exc = RateLimitError(
            message=f"Simulated 429 for {key_id}",
            model=model,
            llm_provider="simulated",
        )
    elif status == 500:
        exc = InternalServerError(
            message=f"Simulated 500 for {key_id}",
            model=model,
            llm_provider="simulated",
        )
    elif status == 502:
        exc = ServiceUnavailableError(
            message=f"Simulated 502 for {key_id}",
            model=model,
            llm_provider="simulated",
        )
    elif status == 503:
        exc = ServiceUnavailableError(
            message=f"Simulated 503 for {key_id}",
            model=model,
            llm_provider="simulated",
        )
    else:
        exc = ServiceUnavailableError(
            message=f"Simulated error {status} for {key_id}",
            model=model,
            llm_provider="simulated",
        )
    exc.status_code = status
    raise exc


# ── Custom cache key (model + messages only, NOT api_key) ────────────────────

def _custom_cache_key(messages: list[dict], model: str) -> str:
    """Build a cache key from *model* and *messages* only.

    This guarantees that a reply cached via key_1 is still a hit when
    key_2 is first in line.
    """
    blob = json.dumps({"model": model, "messages": messages}, sort_keys=True)
    return "llm_cache:" + hashlib.sha256(blob.encode()).hexdigest()


# ── Main entry point ────────────────────────────────────────────────────────

async def chat_completion(
    messages: list[dict],
    *,
    simulate_header: Optional[str] = None,
) -> LLMResult:
    """Call the LLM with ordered key fallback and caching.

    Parameters
    ----------
    messages:
        The full message list (system + history + new user message).
    simulate_header:
        Raw value of ``X-Simulate-Failure``, or *None*.

    Returns
    -------
    LLMResult with all metadata fields.

    Raises
    ------
    AllProvidersUnavailable
        If every key fails.
    """
    model = config.settings.llm_model
    keys = config.settings.api_keys
    key_ids = config.settings.key_ids

    # Parse simulation rules (empty when disabled or absent).
    sim_rules: dict[str, int] = {}
    if config.settings.enable_failure_simulation and simulate_header:
        sim_rules = _parse_simulation_header(simulate_header)

    # Build the custom cache key.
    cache_key = _custom_cache_key(messages, model)

    # Determine whether to bypass cache reads (simulation present).
    bypass_cache_read = bool(sim_rules)

    fallback_attempts = 0
    last_exc: Optional[Exception] = None

    for idx, (api_key, key_id) in enumerate(zip(keys, key_ids)):
        t0 = time.perf_counter()
        try:
            # --- Simulated failure (pre-call) ---
            if key_id in sim_rules:
                _raise_simulated(sim_rules[key_id], key_id)
            if "*" in sim_rules:
                _raise_simulated(sim_rules["*"], key_id)

            # --- Mock completion for offline testing / browser validation ---
            if config.settings.mock_completion:
                cached_item = None
                if not bypass_cache_read:
                    try:
                        cached_item = litellm.cache.get_cache(cache_key)
                    except Exception:
                        pass

                if cached_item is not None and isinstance(cached_item, dict):
                    latency_ms = max(2, int((time.perf_counter() - t0) * 1000))
                    return LLMResult(
                        reply=cached_item["reply"],
                        resolution_source="LLM_CACHE",
                        model=model,
                        input_tokens=cached_item["input_tokens"],
                        output_tokens=cached_item["output_tokens"],
                        key_id=None,
                        fallback_attempts=0,
                        latency_ms=latency_ms,
                    )

                last_msg = messages[-1]["content"] if messages else ""
                if "capital of france" in last_msg.lower():
                    mock_reply = "The capital of France is Paris."
                elif "failover" in last_msg.lower():
                    mock_reply = "Key failover automatically switches to backup keys when errors occur, ensuring zero downtime."
                elif "fibonacci" in last_msg.lower():
                    mock_reply = "```python\ndef fib(n: int, memo: dict = {}) -> int:\n    if n <= 1: return n\n    if n not in memo:\n        memo[n] = fib(n-1, memo) + fib(n-2, memo)\n    return memo[n]\n```"
                else:
                    mock_reply = f"I received: '{last_msg}'. Gateway processing completed successfully."

                prompt_tokens = sum(len(m.get("content", "").split()) for m in messages) * 2 + 10
                completion_tokens = len(mock_reply.split()) * 2

                try:
                    litellm.cache.set_cache(
                        cache_key,
                        {
                            "reply": mock_reply,
                            "input_tokens": prompt_tokens,
                            "output_tokens": completion_tokens,
                        },
                    )
                except Exception:
                    pass

                latency_ms = max(45, int((time.perf_counter() - t0) * 1000))
                return LLMResult(
                    reply=mock_reply,
                    resolution_source="LIVE_INFERENCE",
                    model=model,
                    input_tokens=prompt_tokens,
                    output_tokens=completion_tokens,
                    key_id=key_id,
                    fallback_attempts=fallback_attempts,
                    latency_ms=latency_ms,
                )

            # --- Real LiteLLM call ---
            # We set a custom cache key so api_key is excluded from hashing.
            extra_kwargs: dict = {
                "cache": {"cache_key": cache_key},
            }
            if bypass_cache_read:
                # Force skip cache read; we still write to cache on success.
                extra_kwargs["cache"]["no-cache"] = True

            response = await litellm.acompletion(
                model=model,
                messages=messages,
                api_key=api_key,
                timeout=_REQUEST_TIMEOUT,
                **extra_kwargs,
            )

            latency_ms = int((time.perf_counter() - t0) * 1000)

            # --- Cache hit detection ---
            cache_hit = False
            try:
                cache_hit = bool(
                    response._hidden_params.get("cache_hit")
                )
            except (AttributeError, TypeError):
                pass

            usage = response.usage
            input_tokens = usage.prompt_tokens or 0 if usage else 0
            output_tokens = usage.completion_tokens or 0 if usage else 0
            reply_text = response.choices[0].message.content or ""

            if cache_hit:
                return LLMResult(
                    reply=reply_text,
                    resolution_source="LLM_CACHE",
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    key_id=None,
                    fallback_attempts=0,
                    latency_ms=latency_ms,
                )

            return LLMResult(
                reply=reply_text,
                resolution_source="LIVE_INFERENCE",
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                key_id=key_id,
                fallback_attempts=fallback_attempts,
                latency_ms=latency_ms,
            )

        except (
            RateLimitError,
            ServiceUnavailableError,
            InternalServerError,
            Timeout,
            APIConnectionError,
            NotFoundError,
            AuthenticationError,
            BadRequestError,
        ) as exc:
            status_code = getattr(exc, "status_code", None)
            if status_code is None:
                if isinstance(exc, RateLimitError):
                    status_code = 429
                elif isinstance(exc, AuthenticationError):
                    status_code = 401
                elif isinstance(exc, NotFoundError):
                    status_code = 404
                elif isinstance(exc, BadRequestError):
                    status_code = 400
                elif isinstance(exc, InternalServerError):
                    status_code = 500
                elif isinstance(exc, ServiceUnavailableError):
                    status_code = 503
                elif isinstance(exc, Timeout):
                    status_code = 504
                elif isinstance(exc, APIConnectionError):
                    status_code = 502
                else:
                    status_code = 500

            short_msg = str(exc)[:200]
            if short_msg:
                logger.warning(
                    "%s failed: %s %s - %s",
                    key_id,
                    exc.__class__.__name__,
                    status_code,
                    short_msg,
                )
            else:
                logger.warning(
                    "%s failed: %s %s",
                    key_id,
                    exc.__class__.__name__,
                    status_code,
                )
            last_exc = exc
            fallback_attempts += 1
            continue

    # Every key exhausted.
    raise AllProvidersUnavailable(str(last_exc))
