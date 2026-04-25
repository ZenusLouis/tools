#!/usr/bin/env python3
"""Log a Codex IDE chat summary to the GCS dashboard."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime

from gcs_env import bridge_user_agent, load_dashboard_env


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")


def post_json(path: str, payload: dict) -> bool:
    headers = {"Content-Type": "application/json", "User-Agent": bridge_user_agent()}
    if BRIDGE_TOKEN:
        headers["x-bridge-token"] = BRIDGE_TOKEN
    if HOOK_SECRET:
        headers["x-hook-secret"] = HOOK_SECRET

    try:
        req = urllib.request.Request(
            f"{DASHBOARD_URL}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:
        print(f"Failed to log Codex IDE chat: {exc}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Log a Codex IDE chat summary to GCS.")
    parser.add_argument("notes", nargs="*", help="Summary text. If omitted, stdin is used.")
    parser.add_argument("--project", default=os.environ.get("GCS_PROJECT", "dashboard"))
    parser.add_argument("--role", default=os.environ.get("GCS_ROLE", "dev-implementer"))
    parser.add_argument("--model", default=os.environ.get("GCS_MODEL", "codex-ide"))
    parser.add_argument("--transcript-path", default=None)
    args = parser.parse_args()

    notes = " ".join(args.notes).strip()
    if not notes and not sys.stdin.isatty():
        notes = sys.stdin.read().strip()
    if not notes:
        print("No notes provided. Pass text args or pipe summary through stdin.", file=sys.stderr)
        return 2

    payload = {
        "type": "session",
        "project": args.project,
        "provider": "codex",
        "role": args.role or None,
        "model": args.model or None,
        "date": datetime.now().isoformat(),
        "tasksCompleted": [],
        "cwd": os.getcwd(),
        "sessionNotes": notes,
        "risks": [],
    }
    if args.transcript_path:
        payload["transcriptPath"] = args.transcript_path

    payload = {key: value for key, value in payload.items() if value is not None}

    if not post_json("/api/log", payload):
        return 1
    print("Logged Codex IDE chat summary to GCS dashboard.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
