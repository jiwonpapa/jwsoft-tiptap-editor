"""Usage: python -m harness.jw_harness COMMAND. No production mutation by default."""

import argparse
import subprocess
import sys
from pathlib import Path

from .browser import run_browser
from .clean import clean_caches
from .deploy_entry import deploy_from_environment
from .evidence import record_observation
from .files import ROOT
from .governance import check
from .host import validate_host
from .integration import run_integration
from .provenance import source_fingerprint
from .quality import audit_dependencies, check_all
from .receipt import validate_artifact_execution
from .release import publish_stable


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("check", "governance", "audit", "browser"):
        sub.add_parser(name)
    fingerprint = sub.add_parser("fingerprint")
    fingerprint.add_argument("--root", type=Path, default=ROOT)
    host = sub.add_parser("host-check")
    host.add_argument("--root", type=Path, required=True)
    integration = sub.add_parser("integration")
    integration.add_argument("--host", type=Path, required=True)
    receipt = sub.add_parser("validate-execution")
    receipt.add_argument("--root", type=Path, required=True)
    receipt.add_argument("--artifact", required=True)
    receipt.add_argument("--fingerprint", required=True)
    deploy = sub.add_parser("deploy-transaction")
    deploy.add_argument("--environment", choices=("staging", "production"), required=True)
    deploy.add_argument("--artifact", type=Path, required=True)
    deploy.add_argument("--apply", action="store_true")
    observation = sub.add_parser("record-observation")
    observation.add_argument("input")
    cleanup = sub.add_parser(
        "clean", help="plan cache-only cleanup; evidence and packages preserved"
    )
    cleanup.add_argument("--apply", action="store_true")
    publication = sub.add_parser("publish-stable", help="verify final 62/62, never rebuild")
    publication.add_argument("--tag", required=True)
    publication.add_argument("--apply", action="store_true")
    publication.add_argument("--approval", default="")
    return parser.parse_args()


def dispatch(args: argparse.Namespace) -> None:
    actions = {
        "check": lambda: check_all(ROOT),
        "governance": lambda: check(ROOT),
        "audit": lambda: audit_dependencies(ROOT),
        "browser": lambda: run_browser(ROOT),
        "clean": lambda: print(clean_caches(ROOT, apply=args.apply)),
        "publish-stable": lambda: publish_stable(
            ROOT, args.tag, apply=args.apply, approval=args.approval
        ),
        "fingerprint": lambda: print(source_fingerprint(args.root)),
        "record-observation": lambda: print(record_observation(ROOT, args.input)),
        "host-check": lambda: validate_host(ROOT, args.root),
        "integration": lambda: run_integration(ROOT, args.host),
        "validate-execution": lambda: validate_artifact_execution(
            args.root, args.artifact, args.fingerprint
        ),
        "deploy-transaction": lambda: deploy_from_environment(
            ROOT, args.environment, args.artifact, apply=args.apply
        ),
    }
    actions[args.command]()


def main() -> int:
    try:
        dispatch(arguments())
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"[jwsoft] BLOCKED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
