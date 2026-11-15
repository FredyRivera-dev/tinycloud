SHELL := /bin/bash
GO ?= $(shell command -v go 2>/dev/null || echo /usr/local/go/bin/go)

COMPOSE_DB := docker compose -f docker/docker.dev.postgres.yml
COMPOSE_FULL := docker compose -f docker/docker.dev.full.yml

# Load local overrides (.env is gitignored). All variables are exported to the
# recipes, so both `go run` and `next dev` see them.
-include .env
export

.PHONY: help install db-up db-down db-logs db-reset api-dev web-dev \
	stack-up stack-down stack-logs stack-ps stack-reset test fmt build check

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install backend modules and frontend dependencies
	cd back-end && $(GO) mod download
	cd front-end && npm ci

db-up: ## Start only Postgres for local backend development (port 5433)
	$(COMPOSE_DB) up -d --wait

db-down: ## Stop the development Postgres
	$(COMPOSE_DB) down

db-logs: ## Follow development Postgres logs
	$(COMPOSE_DB) logs -f --tail=100

db-reset: ## Delete the development Postgres volume (destructive)
	$(COMPOSE_DB) down -v

api-dev: ## Run the Go API against the development Postgres
	@test -n "$(DATABASE_URL)" || (echo "Missing DATABASE_URL: copy .env.example to .env" && exit 1)
	cd back-end && $(GO) run ./cmd/api

web-dev: ## Run the Next.js frontend (proxies /api to API_PROXY_TARGET)
	cd front-end && npm run dev

stack-up: ## Build and start the full dev stack (web + api + db)
	$(COMPOSE_FULL) up -d --build

stack-down: ## Stop the full dev stack
	$(COMPOSE_FULL) down

stack-logs: ## Follow logs from the full dev stack
	$(COMPOSE_FULL) logs -f --tail=100

stack-ps: ## Show full dev stack status
	$(COMPOSE_FULL) ps

stack-reset: ## Delete the full stack, including its Postgres volume (destructive)
	$(COMPOSE_FULL) down -v

test: ## Run backend tests
	cd back-end && $(GO) test ./...

fmt: ## Format Go code
	cd back-end && gofmt -w ./cmd ./internal

check: ## Vet and test the backend
	cd back-end && $(GO) vet ./... && $(GO) test ./...

build: ## Build backend and frontend
	cd back-end && $(GO) build ./...
	cd front-end && npm run build
