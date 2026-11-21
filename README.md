# Fault-Tolerant LLM Chatbot with Key Failover & Response Caching

A full-stack, production-grade conversational AI platform built with **FastAPI**, **LiteLLM**, **SQLite (WAL mode)**, and **React + Vite (TypeScript)**. Designed for enterprise-level resilience, automatic key rotation on rate limits (429/5xx), deterministic in-memory response caching, and transparent per-request token usage tracking.

---

## 1. Live URLs

- **Frontend Application**: `https://your-frontend-deployment.vercel.app` *(or your live deployment URL)*
- **Backend API Base**: `https://your-backend-deployment.onrender.com` *(or your live deployment URL)*
- **Interactive API Docs (Swagger UI)**: `https://your-backend-deployment.onrender.com/docs`
- **Health Check Endpoint**: `https://your-backend-deployment.onrender.com/health`

---

## 2. Run locally: with Docker and without

### Option A: With Docker (Recommended)

Requires Docker and Docker Compose installed.

```bash
# Clone the repository
git clone https://github.com/your-username/fault-tolerant-llm.git
cd fault-tolerant-llm

# Copy environment variables
cp .env.example .env
# Edit .env to add your LLM_API_KEYS (or leave default placeholders for local test mode)

# Start backend and frontend together with a persistent SQLite volume
make up

# Services are now live:
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000 (Health: http://localhost:8000/health)

# Stop services
make down
```

---

### Option B: Without Docker

#### 1. Backend Setup (FastAPI + LiteLLM + SQLite)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run unit and integration tests (19 test cases, 100% passing)
python -m pytest tests/ -v

# Start backend development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Setup (React + Vite + TypeScript)

```bash
cd frontend

# Install npm dependencies
npm install

# Run contract tests
npm test

# Start frontend development server
npm run dev
# Accessible at http://localhost:3000
```

---

## 3. Design decisions: key fallback, caching, SQLite session storage

### Key Fallback Mechanism
- **Explicit Key Loop vs. Router**: Instead of using LiteLLM's internal black-box `Router`, we implemented an explicit, ordered loop over the configured key pool (`key_1`, `key_2`, ...). This architectural choice enables exact tracking and reporting of which key resolved the request (`key_id`), as well as the exact number of retry attempts (`fallback_attempts`).
- **Resilient Error Categorization**: Retries only trigger on transient errors (`RateLimitError`, quota errors, 5xx server errors, network connection drops, and request timeouts). If all keys are exhausted, a standard HTTP 503 `{"detail": "all providers unavailable"}` is returned.
- **Pre-Call Simulation**: In simulation mode (`X-Simulate-Failure`), failures are injected *before* dispatching network requests, preventing wasteful quota depletion and eliminating persistent cooldowns across requests.

### Response Caching Strategy
- **LiteLLM Local Cache**: Powered by `litellm.cache = Cache(type="local")` with `temperature=0` for deterministic, repeatable outputs.
- **Key-Agnostic Cache Key**: To guarantee cache hits across different keys in the pool, cache keys are constructed solely from the canonical hash of `model + messages` (excluding `api_key`). A response generated via `key_1` immediately yields an `LLM_CACHE` hit on identical subsequent prompts even when `key_2` is next in line.
- **Cache Hit Metadata**: On cache hits, `resolution_source` is set to `LLM_CACHE`, `key_id` to `null`, `fallback_attempts` to `0`, and recorded prompt/completion tokens reflect the stored payload.

### SQLite Session Storage
- **Native Async with aiosqlite**: All database operations run asynchronously using `aiosqlite`, avoiding thread pool bottlenecks.
- **Write-Ahead Logging (WAL)**: Enabled via `PRAGMA journal_mode=WAL` on startup to maximize read/write concurrency and prevent lock contention during multi-turn chats.
- **Transactional History**: User and assistant messages are only committed after a successful completion. Failed requests (422 or 503) never pollute conversation history.

---

## 4. Verification: how to see failover, cache hits and per-message token usage

### 1. Verification via Interactive UI
1. **Live Inference**: Type `"What is the capital of France?"` and send. Observe the green `LIVE_INFERENCE` badge, `key_1`, and recorded token usage.
2. **Response Cache Hit**: Click **"New Chat"** (generating a fresh `session_id`) and submit the exact same question. Observe the purple `LLM_CACHE` badge, `key_id: null`, and latency drop.
3. **Automatic Key Failover**: Open the **"Demo Tools"** drawer, select `key_1=429`, and send `"Explain key failover"`. The request succeeds (HTTP 200) with a notification toast indicating recovery via `key_2` with `fallback_attempts: 1`.
4. **Service Outage Handling**: In Demo Tools, select `*=429` and send a message. An inline error card displays `"All providers are currently unavailable, please try again."` without corrupting chat history or rendering an empty assistant message.
5. **Per-Message Token Tracking**: Notice that subsequent conversation turns display tokens only for that individual turn (prompt + completion), never a cumulative conversation sum.

### 2. Verification via Command Line (Automated Smoke Suite)

```bash
# Run the automated smoke suite against any base URL
bash scripts/smoke.sh http://localhost:8000
```

---

## 5. Setup Used: your editor and AI tools

- **IDE & Development Environment**: Visual Studio Code & PowerShell on Windows 11.
- **AI Tooling & Coding Assistants**: Antigravity agentic workflow with DeepMind models for architecture design, test scaffolding, and validation.
- **Testing & Diagnostics**: `pytest` + `pytest-asyncio` + `httpx` for backend mocking; `vitest` + `@testing-library/react` for frontend contract validation.

---

## 6. Bonus features (if any): what you added beyond the requirements and why

1. **Interactive Demo Tools Panel**: Built a collapsible header drawer in the frontend providing 1-click toggling of `X-Simulate-Failure` headers (`None`, `key_1=429`, `key_1=429,key_2=500`, `*=429`), making failover immediately testable without browser DevTools or curl.
2. **Dynamic Recovery Toast Notifications**: Animated notification toasts alert the user whenever a key fallback occurred (e.g. *"Recovered via key_2 after 1 failed attempt"*).
3. **Rich Markdown & Code Block Copy**: Assistant messages render GitHub-flavored markdown with clean syntax styling and one-click code copy buttons.
4. **Dark / Light Theme Toggle**: Seamless UI theme switching with `localStorage` persistence and automatic system preference detection.
5. **Offline Mock Mode (`MOCK_COMPLETION`)**: Added optional local mock mode allowing full-stack demo and integration testing even in air-gapped or network-restricted environments without requiring active Gemini API credentials.
