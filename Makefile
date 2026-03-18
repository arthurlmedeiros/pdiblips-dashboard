.PHONY: lint build test

lint:
	cd ../.. && npm run lint -- --filter=dashboard

build:
	cd ../.. && npm run build

test:
	cd ../.. && npm test -- --filter=dashboard
