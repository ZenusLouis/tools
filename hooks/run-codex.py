#!/usr/bin/env python3
"""Run Codex locally and send a session log to the GCS dashboard."""

import json
import os
import shutil
import subprocess
import sys
import time
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
        with urllib.request.urlopen(req, timeout=5) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def send_heartbeat() -> None:
    if not BRIDGE_TOKEN and not HOOK_SECRET:
        return
    post_json(
        "/api/bridge/heartbeat",
        {
            "deviceKey": os.environ.get("GCS_DEVICE_KEY", os.environ.get("COMPUTERNAME", "local").lower()),
            "name": os.environ.get("GCS_DEVICE_NAME", os.environ.get("COMPUTERNAME", "Local Codex")),
            "claudeAvailable": shutil.which("claude") is not None,
            "codexAvailable": shutil.which("codex") is not None,
            "metadata": {"cwd": os.getcwd(), "runner": "hooks/run-codex.py"},
        },
    )


def append_local_session(payload: dict) -> None:
    root = os.environ.get("CLAUDE_ROOT", r"d:\GlobalClaudeSkills")
    logs_dir = os.path.join(root, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    log_path = os.path.join(logs_dir, f"global-{datetime.now().date().isoformat()}.jsonl")
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> int:
    codex = os.environ.get("GCS_CODEX_BIN") or shutil.which("codex")
    if not codex:
        print("codex executable not found in PATH", file=sys.stderr)
        return 127

    args = sys.argv[1:]
    if not args:
        print("Usage: python hooks/run-codex.py <codex args...>", file=sys.stderr)
        return 2

    send_heartbeat()
    started = time.time()
    result = subprocess.run([codex, *args], cwd=os.getcwd())
    duration_min = round((time.time() - started) / 60, 3)

    payload = {
        "type": "session",
        "project": os.environ.get("GCS_PROJECT", "local"),
        "provider": "codex",
        "role": os.environ.get("GCS_ROLE") or "dev-implementer",
        "model": os.environ.get("GCS_MODEL") or None,
        "date": datetime.now().isoformat(),
        "tasksCompleted": [],
        "cwd": os.getcwd(),
        "durationMin": duration_min,
        "sessionNotes": f"Codex local session exited with code {result.returncode}",
        "risks": [] if result.returncode == 0 else [f"codex exit code {result.returncode}"],
    }

    if not post_json("/api/log", payload):
        append_local_session(payload)

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
