.PHONY: install dev build lint test test-watch test-coverage ci clean

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

ci:
	npm run ci

clean:
	rm -rf dist node_modules
