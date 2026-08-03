.PHONY: test lint coverage docs docs-dev agent-test

test:
	pytest -q

lint:
	ruff check app.py core tests

coverage:
	pytest -q --cov=core --cov=app --cov-report=term-missing

docs:
	npm run docs:build

docs-dev:
	npm run docs:dev

agent-test:
	cd agent && go build ./... && go vet ./... && go test ./...
