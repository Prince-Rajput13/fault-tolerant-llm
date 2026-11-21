.PHONY: up down build test-backend test-frontend test clean

# Start both backend and frontend via Docker Compose
up:
	docker compose up --build -d

# Stop all running services
down:
	docker compose down

# Rebuild images without starting
build:
	docker compose build

# Run backend unit tests
test-backend:
	cd backend && python -m pytest tests/ -v

# Run frontend tests
test-frontend:
	cd frontend && npm test

# Run all test suites
test: test-backend test-frontend

# Clean up build artifacts and temporary databases
clean:
	docker compose down -v
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type f -name "*.db" -delete
