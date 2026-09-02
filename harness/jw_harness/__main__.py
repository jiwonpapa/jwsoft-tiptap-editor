"""Usage: python -m harness.jw_harness COMMAND. No production mutation by default."""

import argparse
import subprocess
import sys
from pathlib import Path

from .browser import run_browser
from .clean import clean_caches
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


def main() -> int:
    args = arguments()
    checks = {
        "check": check_all,
        "governance": check,
        "audit": audit_dependencies,
        "browser": run_browser,
    }
    try:
        if args.command in checks:
            checks[args.command](ROOT)
        elif args.command == "clean":
            print(clean_caches(ROOT, apply=args.apply))
        elif args.command == "publish-stable":
            publish_stable(ROOT, args.tag, apply=args.apply, approval=args.approval)
        elif args.command == "fingerprint":
            print(source_fingerprint(args.root))
        elif args.command == "record-observation":
            print(record_observation(ROOT, args.input))
        elif args.command == "host-check":
            validate_host(ROOT, args.root)
        elif args.command == "integration":
            run_integration(ROOT, args.host)
        elif args.command == "validate-execution":
            validate_artifact_execution(args.root, args.artifact, args.fingerprint)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"[jwsoft] BLOCKED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
