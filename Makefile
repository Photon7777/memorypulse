PYTHON ?= python3

.PHONY: install bootstrap update validate compact frontend test build verify

install:
	$(PYTHON) -m pip install -e ".[dev]"
	cd frontend && npm ci

bootstrap:
	$(PYTHON) -m memorypulse.cli export --production

update:
	$(PYTHON) -m memorypulse.cli update

validate:
	$(PYTHON) -m memorypulse.cli validate

compact:
	$(PYTHON) -m memorypulse.cli compact

frontend:
	cd frontend && npm run dev

test:
	$(PYTHON) -m pytest
	cd frontend && npm run test:run

build:
	cd frontend && npm run build

verify:
	PYTHON=$(PYTHON) ./scripts/verify.sh
