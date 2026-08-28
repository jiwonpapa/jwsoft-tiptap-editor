SHELL := /bin/bash

.PHONY: bootstrap doctor check build test integration-check parity-evidence parity-gate package release-check deploy-plan deploy clean

bootstrap:
	npm ci
	COMPOSER_ROOT_VERSION=$$(node -p "require('./package.json').version") composer install --no-interaction --prefer-dist

doctor:
	./scripts/doctor.sh

check:
	npm run check
	COMPOSER_ROOT_VERSION=$$(node -p "require('./package.json').version") composer validate --strict --no-check-publish
	php tests/php/plugin_activation_test.php
	php tests/php/editor_sanitizer_test.php
	php tests/php/parity_corpus_test.php
	find src tests/php tests/integration -name '*.php' -print0 | xargs -0 -n1 php -l
	./scripts/check-shell.sh

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

release-check: check build integration-check package parity-evidence parity-gate

deploy-plan:
	./scripts/deploy.sh "$(ENV)" --plan

deploy:
	@if [ "$(APPLY)" != "1" ]; then echo "APPLY=1 이 필요합니다."; exit 1; fi
	./scripts/deploy.sh "$(ENV)" --apply

clean:
	rm -rf .build dist coverage playwright-report test-results
