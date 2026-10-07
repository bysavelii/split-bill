.PHONY: check typecheck lint test build

check: typecheck lint test build

typecheck:
	npm run --silent typecheck

lint:
	npm run --silent lint

test:
	npm run --silent test

build:
	npm run --silent build
