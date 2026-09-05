"""Usage: python -m harness.jw_harness COMMAND. No production mutation by default."""

import argparse
import subprocess
import sys
from pathlib import Path

from .audit import audit_dependencies
from .browser import run_browser
from .clean import clean_caches
from .dependencies import audit_python
from .deploy_entry import deploy_from_environment
from .evidence import record_observation
from .files import ROOT
from .g7_browser import run_g7_browser
from .governance import check
from .host import validate_host
from .integration import run_integration
from .lifecycle import run_lifecycle
from .provenance import source_fingerprint
from .quality import check_all
from .receipt import validate_artifact_execution
from .release import publish_candidate, publish_stable


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("check", "governance", "audit", "audit-python", "browser"):
        sub.add_parser(name)
    fingerprint = sub.add_parser("fingerprint")
    fingerprint.add_argument("--root", type=Path, default=ROOT)
    host = sub.add_parser("host-check")
    host.add_argument("--root", type=Path, required=True)
    integration = sub.add_parser("integration")
    integration.add_argument("--host", type=Path, required=True)
    g7_browser = sub.add_parser("g7-browser")
    g7_browser.add_argument("--host", type=Path, required=True)
    g7_browser.add_argument("--base", required=True)
    lifecycle = sub.add_parser("lifecycle")
    lifecycle.add_argument("--host", type=Path, required=True)
    lifecycle.add_argument("--previous", type=Path, required=True)
    lifecycle.add_argument("--current", type=Path)
    lifecycle.add_argument("--records", type=int, nargs=3, required=True)
    lifecycle.add_argument("--github", action="store_true")
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
    for name in ("publish-candidate", "publish-stable"):
        publication = sub.add_parser(name, help="verify current evidence, never rebuild")
        publication.add_argument("--tag", required=True)
        publication.add_argument("--apply", action="store_true")
        publication.add_argument("--approval", default="")
    return parser.parse_args()


def dispatch(args: argparse.Namespace) -> None:
    actions = {
        "check": lambda: check_all(ROOT),
        "governance": lambda: check(ROOT),
        "audit": lambda: audit_dependencies(ROOT),
        "audit-python": lambda: print(f"[jwsoft] audited Python tools: {audit_python(ROOT)}"),
        "browser": lambda: run_browser(ROOT),
        "clean": lambda: print(clean_caches(ROOT, apply=args.apply)),
        "publish-candidate": lambda: publish_candidate(
            ROOT, args.tag, apply=args.apply, approval=args.approval
        ),
        "publish-stable": lambda: publish_stable(
            ROOT, args.tag, apply=args.apply, approval=args.approval
        ),
        "fingerprint": lambda: print(source_fingerprint(args.root)),
        "record-observation": lambda: print(record_observation(ROOT, args.input)),
        "host-check": lambda: validate_host(ROOT, args.root),
        "integration": lambda: run_integration(ROOT, args.host),
        "g7-browser": lambda: run_g7_browser(ROOT, args.host, args.base),
        "lifecycle": lambda: run_lifecycle(
            ROOT,
            args.host,
            args.previous,
            args.records,
            github=args.github,
            explicit_current=args.current,
        ),
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
