SHELL := /bin/bash
HARNESS_PYTHON ?= .venv/bin/python
HARNESS = $(HARNESS_PYTHON) -m harness.jw_harness
export HARNESS_PYTHON

.PHONY: bootstrap doctor check build test integration-check parity-evidence parity-gate package license-check license-evidence reproducible-package release-candidate-evidence release-candidate-check stable-readiness-gate release-check deploy-plan deploy clean
.PHONY: governance-check audit browser-check clean-apply

bootstrap:
	python3 -m venv .venv
	$(HARNESS_PYTHON) -m pip install -r harness/requirements-dev.txt
	npm ci
	COMPOSER_ROOT_VERSION=$$(node -p "require('./package.json').version") composer install --no-interaction --prefer-dist

doctor:
	./scripts/doctor.sh

check:
	$(HARNESS) check

governance-check:
	$(HARNESS) governance

audit:
	$(HARNESS) audit

browser-check:
	$(HARNESS) browser

build:
	npm run build

test:
	npm run test:unit

integration-check:
	./scripts/integration-check.sh

parity-gate:
	./scripts/parity-gate.sh

parity-evidence:
	php tests/php/parity_corpus_test.php
	node scripts/performance-budget.mjs
	node scripts/supply-chain-evidence.mjs
	node scripts/generate-parity-evidence.mjs

package:
	./scripts/package.sh

license-check:
	node scripts/license-audit.mjs

reproducible-package: build
	node scripts/reproducible-package.mjs

license-evidence: reproducible-package
	node scripts/license-audit.mjs --artifact

release-candidate-evidence:
	node scripts/write-release-candidate-evidence.mjs

release-candidate-check:
	$(MAKE) audit
	$(MAKE) check
	$(MAKE) build
	$(MAKE) integration-check
	$(MAKE) reproducible-package
	$(MAKE) license-evidence
	$(MAKE) parity-evidence
	$(MAKE) parity-gate
	$(MAKE) release-candidate-evidence

stable-readiness-gate:
	node scripts/stable-readiness-gate.mjs

release-check: parity-gate stable-readiness-gate

deploy-plan:
	./scripts/deploy.sh "$(ENV)" --plan

deploy:
	@if [ "$(APPLY)" != "1" ]; then echo "APPLY=1 이 필요합니다."; exit 1; fi
	./scripts/deploy.sh "$(ENV)" --apply

clean:
	$(HARNESS) clean

clean-apply:
	$(HARNESS) clean --apply
