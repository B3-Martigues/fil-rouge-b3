.PHONY: test-backend test-frontend test-e2e test-all

test-backend:
	cd backend && go test ./...

test-frontend:
	npm --prefix frontend run test:e2e

test-e2e:
	npm --prefix frontend run test:e2e

test-all: test-backend test-frontend
