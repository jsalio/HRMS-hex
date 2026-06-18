.PHONY: up down restart build logs logs-api logs-ui status test test-core open

up:
	docker compose up -d

build:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-ui:
	docker compose logs -f ui

status:
	docker compose ps

test:
	bun run test

test-core:
	bun run test:core

open:
	xdg-open http://localhost:4200
