PROJECT_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DEFAULT_PYTHON := $(if $(wildcard $(PROJECT_ROOT)/.venv/bin/python),$(PROJECT_ROOT)/.venv/bin/python,python3)
PYTHON := $(if $(filter command line,$(origin PYTHON)),$(PYTHON),$(DEFAULT_PYTHON))
export PYTHONPATH := $(PROJECT_ROOT)/pipeline/src$(if $(PYTHONPATH),:$(PYTHONPATH))

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
