"""Comprehensive backend API tests.

All tests mock ``litellm.acompletion`` so no real API keys are needed.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _mock_response(
    content: str = "Hello!",
    prompt_tokens: int = 10,
    completion_tokens: int = 5,
    cache_hit: bool = False,
):
    choice = MagicMock()
    choice.message.content = content
    usage = MagicMock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    resp = MagicMock()
    resp.choices = [choice]
    resp.usage = usage
    resp._hidden_params = {"cache_hit": cache_hit}
    return resp


# ═══════════════════════════════════════════════════════════════════════════
# 1. Health
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_health(mock_llm, client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["keys_configured"] == 2
    assert body["cache_enabled"] is True


# ═══════════════════════════════════════════════════════════════════════════
# 2. Happy path
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_chat_happy_path(mock_llm, client):
    mock_llm.return_value = _mock_response("Paris is the capital.", 42, 9)

    resp = await client.post("/chat", json={
        "session_id": "s-happy",
        "message": "What is the capital of France?",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "s-happy"
    assert body["reply"] == "Paris is the capital."
    meta = body["metadata"]
    assert meta["resolution_source"] == "LIVE_INFERENCE"
    assert meta["model"] == "gemini/gemini-2.5-flash"
    assert meta["key_id"] == "key_1"
    assert meta["fallback_attempts"] == 0
    assert meta["input_tokens"] == 42
    assert meta["output_tokens"] == 9
    assert isinstance(meta["latency_ms"], int)


# ═══════════════════════════════════════════════════════════════════════════
# 3. Cache hit – same first message in a NEW session
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_cache_hit(mock_llm, client):
    live = _mock_response("Paris is the capital.", 42, 9, cache_hit=False)
    cached = _mock_response("Paris is the capital.", 42, 9, cache_hit=True)
    mock_llm.side_effect = [live, cached]

    # First call → LIVE
    r1 = await client.post("/chat", json={
        "session_id": "s-cache-1",
        "message": "What is the capital of France?",
    })
    assert r1.status_code == 200
    m1 = r1.json()["metadata"]
    assert m1["resolution_source"] == "LIVE_INFERENCE"
    assert m1["key_id"] == "key_1"
    lat1 = m1["latency_ms"]

    # Second call, DIFFERENT session, same message → CACHE
    r2 = await client.post("/chat", json={
        "session_id": "s-cache-2",
        "message": "What is the capital of France?",
    })
    assert r2.status_code == 200
    body2 = r2.json()
    m2 = body2["metadata"]
    assert m2["resolution_source"] == "LLM_CACHE"
    assert m2["key_id"] is None
    assert m2["fallback_attempts"] == 0
    assert body2["reply"] == "Paris is the capital."
    # Cache hit should have tokens from the stored usage.
    assert m2["input_tokens"] == 42
    assert m2["output_tokens"] == 9


# ═══════════════════════════════════════════════════════════════════════════
# 4. Different message → never cached
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_different_message_no_cache(mock_llm, client):
    mock_llm.return_value = _mock_response("Berlin.", 15, 3, cache_hit=False)

    resp = await client.post("/chat", json={
        "session_id": "s-diff",
        "message": "What is the capital of Germany?",
    })
    assert resp.status_code == 200
    assert resp.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"


# ═══════════════════════════════════════════════════════════════════════════
# 5. Multi-turn memory
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_multi_turn_memory(mock_llm, client):
    mock_llm.side_effect = [
        _mock_response("Paris.", 10, 3),
        _mock_response("Yes, it is in France.", 25, 6),
    ]

    # Turn 1
    await client.post("/chat", json={
        "session_id": "s-multi",
        "message": "What is the capital of France?",
    })

    # Turn 2 – the LLM should receive the full history.
    await client.post("/chat", json={
        "session_id": "s-multi",
        "message": "Tell me more about it.",
    })

    # Inspect the messages sent to acompletion on the second call.
    second_call = mock_llm.call_args_list[1]
    msgs = second_call.kwargs.get("messages") or second_call.args[0] if second_call.args else second_call.kwargs["messages"]
    # Should have: system + user1 + assistant1 + user2 = 4 messages
    assert len(msgs) == 4
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"
    assert msgs[2]["role"] == "assistant"
    assert msgs[3]["role"] == "user"
    assert msgs[3]["content"] == "Tell me more about it."


# ═══════════════════════════════════════════════════════════════════════════
# 6. Session isolation
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_session_isolation(mock_llm, client):
    mock_llm.return_value = _mock_response("Answer.", 10, 3)

    await client.post("/chat", json={
        "session_id": "s-iso-A",
        "message": "Message in session A",
    })
    await client.post("/chat", json={
        "session_id": "s-iso-B",
        "message": "Message in session B",
    })

    # Session A history should not contain B's message.
    resp_a = await client.get("/sessions/s-iso-A/messages")
    msgs_a = resp_a.json()["messages"]
    assert len(msgs_a) == 2  # user + assistant
    assert msgs_a[0]["content"] == "Message in session A"

    resp_b = await client.get("/sessions/s-iso-B/messages")
    msgs_b = resp_b.json()["messages"]
    assert len(msgs_b) == 2
    assert msgs_b[0]["content"] == "Message in session B"


# ═══════════════════════════════════════════════════════════════════════════
# 7. History endpoint
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_history_endpoint(mock_llm, client):
    mock_llm.return_value = _mock_response("Reply.", 10, 3)

    await client.post("/chat", json={
        "session_id": "s-hist",
        "message": "Hello",
    })

    resp = await client.get("/sessions/s-hist/messages")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "s-hist"
    msgs = body["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello"
    assert msgs[0].get("metadata") is None
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Reply."
    meta = msgs[1]["metadata"]
    assert "resolution_source" in meta
    assert "input_tokens" in meta
    assert "output_tokens" in meta


# ═══════════════════════════════════════════════════════════════════════════
# 8. History 404
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_history_404(mock_llm, client):
    resp = await client.get("/sessions/nonexistent/messages")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "session not found"


# ═══════════════════════════════════════════════════════════════════════════
# 9. Validation 422
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_validation_empty_message(mock_llm, client):
    resp = await client.post("/chat", json={
        "session_id": "s-val",
        "message": "",
    })
    assert resp.status_code == 422


@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_validation_whitespace_only(mock_llm, client):
    resp = await client.post("/chat", json={
        "session_id": "s-val",
        "message": "   \n\t  ",
    })
    assert resp.status_code == 422


@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_validation_too_long(mock_llm, client):
    resp = await client.post("/chat", json={
        "session_id": "s-val",
        "message": "x" * 4001,
    })
    assert resp.status_code == 422


@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_validation_missing_session(mock_llm, client):
    resp = await client.post("/chat", json={
        "message": "Hello",
    })
    assert resp.status_code == 422


@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_validation_malformed_json(mock_llm, client):
    resp = await client.post(
        "/chat",
        content="not json at all",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body


# ═══════════════════════════════════════════════════════════════════════════
# 10. Failover: key_1=429 → 200 with key_2
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_failover_key1_429(mock_llm, client):
    # Only key_2 should be called (key_1 is simulated-fail before the call).
    mock_llm.return_value = _mock_response("Answer via key_2.", 10, 3)

    resp = await client.post(
        "/chat",
        json={"session_id": "s-fo1", "message": "Hello"},
        headers={"X-Simulate-Failure": "key_1=429"},
    )
    assert resp.status_code == 200
    meta = resp.json()["metadata"]
    assert meta["key_id"] == "key_2"
    assert meta["fallback_attempts"] == 1
    assert meta["resolution_source"] == "LIVE_INFERENCE"


# ═══════════════════════════════════════════════════════════════════════════
# 11. All keys fail → 503
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_all_keys_fail_503(mock_llm, client):
    resp = await client.post(
        "/chat",
        json={"session_id": "s-fo2", "message": "Hello"},
        headers={"X-Simulate-Failure": "key_1=429,key_2=500"},
    )
    assert resp.status_code == 503
    assert resp.json()["detail"] == "all providers unavailable"

    # Nothing should be stored.
    hist = await client.get("/sessions/s-fo2/messages")
    assert hist.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# 12. Wildcard *=429 → 503
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_wildcard_fail_503(mock_llm, client):
    resp = await client.post(
        "/chat",
        json={"session_id": "s-fo3", "message": "Hello"},
        headers={"X-Simulate-Failure": "*=429"},
    )
    assert resp.status_code == 503
    assert resp.json()["detail"] == "all providers unavailable"

    hist = await client.get("/sessions/s-fo3/messages")
    assert hist.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# 13. Simulation disabled → header ignored
# ═══════════════════════════════════════════════════════════════════════════

async def test_simulation_disabled(client, monkeypatch):
    monkeypatch.setenv("ENABLE_FAILURE_SIMULATION", "false")
    from app import config
    config.settings = config.Settings()

    with patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = _mock_response("Still works.", 10, 3)
        resp = await client.post(
            "/chat",
            json={"session_id": "s-disabled", "message": "Hello"},
            headers={"X-Simulate-Failure": "*=429"},
        )
        # Should NOT 503 because simulation is disabled.
        assert resp.status_code == 200
        assert resp.json()["metadata"]["key_id"] == "key_1"


# ═══════════════════════════════════════════════════════════════════════════
# 14. Tokens are per-request, not cumulative
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_tokens_per_request(mock_llm, client):
    mock_llm.side_effect = [
        _mock_response("First.", 10, 3),
        _mock_response("Second.", 25, 6),
    ]

    r1 = await client.post("/chat", json={
        "session_id": "s-tok",
        "message": "Turn one",
    })
    r2 = await client.post("/chat", json={
        "session_id": "s-tok",
        "message": "Turn two",
    })

    m1 = r1.json()["metadata"]
    m2 = r2.json()["metadata"]

    # Second request should report its own tokens, not cumulative.
    assert m1["input_tokens"] == 10
    assert m1["output_tokens"] == 3
    assert m2["input_tokens"] == 25
    assert m2["output_tokens"] == 6


# ═══════════════════════════════════════════════════════════════════════════
# 15. 422 must not add anything to history
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_422_no_history(mock_llm, client):
    # Send an invalid message.
    await client.post("/chat", json={
        "session_id": "s-422",
        "message": "   ",
    })
    # Session should not exist.
    hist = await client.get("/sessions/s-422/messages")
    assert hist.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# 16. Failed key attempts logged with logger.warning
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.logger.warning")
@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_failed_key_logging(mock_llm, mock_logger, client):
    mock_llm.return_value = _mock_response("Recovered via key_2.", 10, 3)

    resp = await client.post(
        "/chat",
        json={"session_id": "s-log-test", "message": "Test logging"},
        headers={"X-Simulate-Failure": "key_1=429"},
    )
    assert resp.status_code == 200
    assert resp.json()["metadata"]["key_id"] == "key_2"

    # Verify logger.warning was called for key_1
    assert mock_logger.called
    warning_args = mock_logger.call_args[0]
    # Check that key_id, exception class, status code are logged in "key_N failed: <Class> <status>" format
    assert "key_1" in warning_args
    assert "RateLimitError" in warning_args
    assert 429 in warning_args

    # Verify the raw api key is NEVER logged
    full_log_str = " ".join(str(a) for a in warning_args)
    assert "fake-key-1" not in full_log_str
    assert "fake-key-2" not in full_log_str


# ═══════════════════════════════════════════════════════════════════════════
# 17. AuthenticationError / NotFoundError / BadRequestError fail over to next key
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.llm_gateway.logger.warning")
@patch("app.llm_gateway.litellm.acompletion", new_callable=AsyncMock)
async def test_auth_error_failover(mock_llm, mock_logger, client):
    from litellm.exceptions import AuthenticationError

    # key_1 fails with AuthenticationError, key_2 succeeds
    auth_err = AuthenticationError(message="Invalid API Key", model="gemini/gemini-2.5-flash", llm_provider="gemini")
    auth_err.status_code = 401
    mock_llm.side_effect = [auth_err, _mock_response("Success on key_2", 10, 3)]

    resp = await client.post(
        "/chat",
        json={"session_id": "s-auth-fo", "message": "Hello"},
    )
    assert resp.status_code == 200
    assert resp.json()["metadata"]["key_id"] == "key_2"
    assert resp.json()["metadata"]["fallback_attempts"] == 1

    # Check that key_1 failure was logged
    warning_args = mock_logger.call_args[0]
    assert "key_1" in warning_args
    assert "AuthenticationError" in warning_args
    assert 401 in warning_args


# ═══════════════════════════════════════════════════════════════════════════
# 18. Global exception handler logs unhandled error with request path
# ═══════════════════════════════════════════════════════════════════════════

@patch("app.main.logger.exception")
@patch("app.routes.health.db_reachable", new_callable=AsyncMock)
async def test_global_exception_handler_logging(mock_db, mock_logger, client):
    mock_db.side_effect = RuntimeError("Catastrophic database crash")

    resp = await client.get("/health")
    assert resp.status_code == 500
    assert resp.json() == {"detail": "internal server error"}

    # Verify logger.exception was called with request.url.path
    assert mock_logger.called
    log_args = mock_logger.call_args[0]
    assert "Unhandled error on %s" in log_args[0]
    assert "/health" in log_args


