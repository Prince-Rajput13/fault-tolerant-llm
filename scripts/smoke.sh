#!/usr/bin/env bash
# smoke.sh – curl-based smoke tests for the backend API.
# Usage:  bash scripts/smoke.sh [BASE_URL]
#         Default BASE_URL = http://localhost:8000

set -euo pipefail

BASE="${1:-http://localhost:8000}"
SESSION="smoke-$(date +%s)"

echo "=== Backend Smoke Tests ==="
echo "Base URL: $BASE"
echo "Session:  $SESSION"
echo

# ── 1. Health ────────────────────────────────────────────────────────────
echo "--- 1. GET /health ---"
curl -s "$BASE/health" | python3 -m json.tool
echo

# ── 2. Chat (happy path) ────────────────────────────────────────────────
echo "--- 2. POST /chat (happy path) ---"
curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"message\": \"What is the capital of France?\"}" \
  | python3 -m json.tool
echo

# ── 3. Chat (cache hit – same message, new session) ─────────────────────
echo "--- 3. POST /chat (cache hit) ---"
curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"${SESSION}-cache\", \"message\": \"What is the capital of France?\"}" \
  | python3 -m json.tool
echo

# ── 4. Chat (multi-turn) ────────────────────────────────────────────────
echo "--- 4. POST /chat (multi-turn, same session) ---"
curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"message\": \"Tell me more about it.\"}" \
  | python3 -m json.tool
echo

# ── 5. Session history ──────────────────────────────────────────────────
echo "--- 5. GET /sessions/{id}/messages ---"
curl -s "$BASE/sessions/$SESSION/messages" | python3 -m json.tool
echo

# ── 6. Session 404 ──────────────────────────────────────────────────────
echo "--- 6. GET /sessions/nonexistent/messages (404) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE/sessions/nonexistent-session/messages"
echo

# ── 7. Validation 422 (empty message) ───────────────────────────────────
echo "--- 7. POST /chat (422 – empty message) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"message\": \"\"}"
echo

# ── 8. Validation 422 (whitespace only) ─────────────────────────────────
echo "--- 8. POST /chat (422 – whitespace only) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"message\": \"   \"}"
echo

# ── 9. Failover: key_1=429 → key_2 ──────────────────────────────────────
echo "--- 9. POST /chat (failover key_1=429) ---"
curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d "{\"session_id\": \"${SESSION}-fo\", \"message\": \"Failover test\"}" \
  | python3 -m json.tool
echo

# ── 10. All keys fail: *=429 → 503 ──────────────────────────────────────
echo "--- 10. POST /chat (all keys fail *=429 → 503) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d "{\"session_id\": \"${SESSION}-all\", \"message\": \"Should fail\"}"
echo

# ── 11. key_1=429,key_2=500 → 503 ───────────────────────────────────────
echo "--- 11. POST /chat (key_1=429,key_2=500 → 503) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429,key_2=500" \
  -d "{\"session_id\": \"${SESSION}-both\", \"message\": \"Should also fail\"}"
echo

echo
echo "=== Smoke tests complete ==="
