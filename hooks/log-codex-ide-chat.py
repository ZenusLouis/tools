#!/usr/bin/env python3
"""Log a Codex IDE chat summary to the GCS dashboard."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
TOKEN_PRICE_PER_MILLION = float(os.environ.get("GCS_CODEX_IDE_TOKEN_PRICE_PER_MILLION", "3.0"))
LOG_DIR = ROOT / "logs"


def estimate_text_tokens(value: str) -> int:
    text = value.strip()
    if not text:
        return 0
    return max(1, round(len(text) / 4))


def estimate_chat_tokens(notes: str) -> dict[str, int]:
    summary_tokens = estimate_text_tokens(notes)
    # The IDE extension does not expose the full transcript here. This estimate
    # treats the supplied summary as a compressed transcript and adds a fixed
    # context multiplier so the dashboard can represent IDE chat activity.
    context_tokens = max(500, summary_tokens * 4) if summary_tokens else 0
    total_tokens = summary_tokens + context_tokens
    return {
        "summaryTokens": summary_tokens,
        "contextTokens": context_tokens,
        "totalTokens": total_tokens,
    }


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


def append_local_log(payload: dict) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"global-{date.today().isoformat()}.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Log a Codex IDE chat summary to GCS.")
    parser.add_argument("notes", nargs="*", help="Summary text. If omitted, stdin is used.")
    parser.add_argument("--project", default=os.environ.get("GCS_PROJECT", "dashboard"))
    parser.add_argument("--role", default=os.environ.get("GCS_ROLE", "dev-implementer"))
    parser.add_argument("--model", default=os.environ.get("GCS_MODEL", "codex-ide"))
    parser.add_argument("--transcript-path", default=None)
    parser.add_argument("--post-now", action="store_true", help="Also POST directly instead of relying on bridge daemon tail sync.")
    args = parser.parse_args()

    notes = " ".join(args.notes).strip()
    if not notes and not sys.stdin.isatty():
        notes = sys.stdin.read().strip()
    if not notes:
        print("No notes provided. Pass text args or pipe summary through stdin.", file=sys.stderr)
        return 2

    token_estimate = estimate_chat_tokens(notes)
    payload = {
        "type": "session",
        "project": args.project,
        "provider": "codex",
        "role": args.role or None,
        "model": args.model or None,
        "date": datetime.now().isoformat(),
        "tasksCompleted": [],
        "cwd": os.getcwd(),
        "totalTokens": token_estimate["totalTokens"],
        "totalCostUSD": round(token_estimate["totalTokens"] * TOKEN_PRICE_PER_MILLION / 1_000_000, 6),
        "sessionNotes": (
            f"{notes}\n\n"
            f"Codex IDE chat token estimate: summary={token_estimate['summaryTokens']}, "
            f"context={token_estimate['contextTokens']}."
        ),
        "risks": [],
    }
    if args.transcript_path:
        payload["transcriptPath"] = args.transcript_path

    payload = {key: value for key, value in payload.items() if value is not None}

    log_path = append_local_log(payload)
    if args.post_now and not post_json("/api/log", payload):
        return 1
    mode = "and posted directly" if args.post_now else "for bridge daemon sync"
    print(f"Queued Codex IDE chat summary in {log_path} {mode}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
