.PHONY: check format-check typecheck lint test build

check: format-check typecheck lint test build

format-check:
	npm run --silent format:check

typecheck:
	npm run --silent typecheck

lint:
	npm run --silent lint

test:
	npm run --silent test

build:
	npm run --silent build
