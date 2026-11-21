.PHONY: up down logs test test-backend test-frontend build clean

# Start both backend and frontend via Docker Compose in detached mode
up:
	docker compose up --build -d

# Stop all running containers
down:
	docker compose down

# Follow real-time service logs
logs:
	docker compose logs -f

# Run all test suites
test: test-backend test-frontend

# Run backend unit & integration tests
test-backend:
	cd backend && python -m pytest tests/ -v

# Run frontend unit & contract tests
test-frontend:
	cd frontend && npm test

# Rebuild container images without starting
build:
	docker compose build

# Clean up containers, volumes, and caches
clean:
	docker compose down -v --remove-orphans
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.db" -delete 2>/dev/null || true
