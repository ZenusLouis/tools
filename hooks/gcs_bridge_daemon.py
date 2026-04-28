#!/usr/bin/env python3
"""Long-running local GCS bridge daemon.

Keeps the local bridge online and syncs new JSONL log lines to the dashboard.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
LOG_DIR = ROOT / "logs"
STATE_PATH = ROOT / "hooks" / ".gcs_bridge_state.json"


def headers() -> dict[str, str]:
    result = {"Content-Type": "application/json", "User-Agent": bridge_user_agent()}
    if BRIDGE_TOKEN:
        result["x-bridge-token"] = BRIDGE_TOKEN
    if HOOK_SECRET:
        result["x-hook-secret"] = HOOK_SECRET
    return result


def post_json(path: str, payload: dict, timeout: int = 8) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(
            f"{DASHBOARD_URL}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers(),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return 200 <= resp.status < 300, body
    except Exception as exc:
        return False, str(exc)


def heartbeat(verbose: bool) -> bool:
    if not BRIDGE_TOKEN and not HOOK_SECRET:
        print("BRIDGE_TOKEN or HOOK_SECRET is not set; bridge cannot authenticate.", flush=True)
        return False

    device_key = os.environ.get("GCS_DEVICE_KEY", socket.gethostname().lower())
    device_name = os.environ.get("GCS_DEVICE_NAME", socket.gethostname())
    ok, detail = post_json(
        "/api/bridge/heartbeat",
        {
            "deviceKey": device_key,
            "name": device_name,
            "claudeAvailable": shutil.which("claude") is not None,
            "codexAvailable": shutil.which("codex") is not None,
            "metadata": {
                "cwd": os.getcwd(),
                "runner": "hooks/gcs_bridge_daemon.py",
                "startedAt": datetime.now().isoformat(),
            },
        },
    )
    if verbose or not ok:
        print(f"[heartbeat] {'ok' if ok else 'failed'} {detail[:160]}", flush=True)
    return ok


def load_state() -> dict[str, int]:
    if not STATE_PATH.exists():
        return {}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): int(value) for key, value in data.items() if isinstance(value, int)}


def save_state(state: dict[str, int]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def normalize_log_entry(entry: dict) -> dict | None:
    if entry.get("type") in {"tool", "session"}:
        payload = dict(entry)
    elif "tool" in entry and "tokens" in entry:
        payload = {
            "type": "tool",
            "ts": entry.get("ts") or entry.get("date") or datetime.now().isoformat(),
            "tool": str(entry.get("tool", "unknown")),
            "tokens": int(entry.get("tokens", 0) or 0),
            "provider": entry.get("provider") or os.environ.get("GCS_PROVIDER", "claude"),
            "role": entry.get("role") or os.environ.get("GCS_ROLE") or None,
            "model": entry.get("model") or os.environ.get("GCS_MODEL") or None,
        }
    else:
        return None

    return {key: value for key, value in payload.items() if value is not None}


def sync_log_file(path: Path, state: dict[str, int], from_end: bool) -> int:
    key = str(path.resolve())
    size = path.stat().st_size
    offset = state.get(key)
    if offset is None:
        offset = size if from_end else 0
    if size < offset:
        offset = 0
    if size == offset:
        state[key] = offset
        return 0

    sent = 0
    with path.open("r", encoding="utf-8") as handle:
        handle.seek(offset)
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            try:
                entry = json.loads(raw)
            except Exception:
                continue
            payload = normalize_log_entry(entry)
            if not payload:
                continue
            ok, detail = post_json("/api/log", payload, timeout=5)
            if ok:
                sent += 1
            else:
                print(f"[sync] failed {path.name}: {detail[:160]}", flush=True)
                break
        state[key] = handle.tell()
    return sent


CODEX_STATE_DB = Path.home() / ".codex" / "state_5.sqlite"
CODEX_STATE_KEY = "__codex_last_updated_at_ms__"
CODEX_SYNC_EXISTING = os.environ.get("GCS_CODEX_SYNC_EXISTING", "").lower() in {"1", "true", "yes"}


def _project_from_cwd(cwd: str) -> str:
    """Extract a short project name from a Codex thread cwd path."""
    clean = cwd.lstrip("\\\\?\\").replace("\\", "/")
    return Path(clean).name or "local"


def sync_codex_threads(state: dict[str, int]) -> int:
    if not CODEX_STATE_DB.exists():
        return 0
    last_ms = state.get(CODEX_STATE_KEY, 0)
    try:
        conn = sqlite3.connect(str(CODEX_STATE_DB), timeout=1, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """SELECT id, updated_at_ms, model, cwd, title, tokens_used, first_user_message
               FROM threads
               WHERE tokens_used > 0 AND updated_at_ms > ?
               ORDER BY updated_at_ms ASC""",
            (last_ms,),
        ).fetchall()
        conn.close()
    except Exception as exc:
        print(f"[codex-sync] sqlite error: {exc}", flush=True)
        return 0

    sent = 0
    max_ms = last_ms
    for row in rows:
        thread_token_key = f"__codex_thread_tokens__:{row['id']}"
        previous_tokens = state.get(thread_token_key)
        current_tokens = int(row["tokens_used"] or 0)
        if previous_tokens is None:
            state[thread_token_key] = current_tokens
            max_ms = max(max_ms, row["updated_at_ms"])
            if not CODEX_SYNC_EXISTING:
                continue
            delta_tokens = current_tokens
        else:
            delta_tokens = max(0, current_tokens - previous_tokens)
            state[thread_token_key] = current_tokens
            max_ms = max(max_ms, row["updated_at_ms"])
            if delta_tokens <= 0:
                continue

        project = _project_from_cwd(row["cwd"] or "")
        event_date = datetime.fromtimestamp(row["updated_at_ms"] / 1000).isoformat()
        tool_payload = {
            "type": "tool",
            "ts": event_date,
            "tool": "CodexIDE",
            "tokens": delta_tokens,
            "provider": "codex",
            "role": os.environ.get("GCS_ROLE") or "dev-implementer",
            "model": row["model"] or None,
            "deviceKey": os.environ.get("GCS_DEVICE_KEY", socket.gethostname().lower()),
        }
        ok, detail = post_json("/api/log", {k: v for k, v in tool_payload.items() if v is not None}, timeout=5)
        if not ok:
            print(f"[codex-sync] failed tool delta {row['id'][:8]}: {detail[:120]}", flush=True)
            break

        payload = {
            "type": "session",
            "project": project,
            "provider": "codex",
            "model": row["model"] or None,
            "date": event_date,
            "tasksCompleted": [],
            "cwd": (row["cwd"] or "").lstrip("\\\\?\\"),
            "totalTokens": delta_tokens,
            "totalCostUSD": round(delta_tokens * 3.0 / 1_000_000, 6),
            "sessionNotes": row["title"] or row["first_user_message"] or None,
            "risks": [],
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        ok, detail = post_json("/api/log", payload, timeout=5)
        if ok:
            sent += 1
        else:
            print(f"[codex-sync] failed thread {row['id'][:8]}: {detail[:120]}", flush=True)
            break

    if max_ms > last_ms:
        state[CODEX_STATE_KEY] = max_ms
    if sent:
        print(f"[codex-sync] synced {sent} Codex thread(s)", flush=True)
    return sent


def sync_logs(state: dict[str, int], from_end: bool) -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(LOG_DIR.glob("global-*.jsonl")):
        total += sync_log_file(path, state, from_end=from_end)
    if total:
        save_state(state)
        print(f"[sync] sent {total} log entr{'y' if total == 1 else 'ies'}", flush=True)
    else:
        save_state(state)
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the long-lived GCS local bridge.")
    parser.add_argument("--heartbeat-interval", type=int, default=30)
    parser.add_argument("--sync-interval", type=int, default=5)
    parser.add_argument("--from-start", action="store_true", help="Sync existing log history on first run.")
    parser.add_argument("--verbose", action="store_true", help="Print successful heartbeat responses.")
    args = parser.parse_args()

    state = load_state()
    next_heartbeat = 0.0
    next_sync = 0.0
    next_codex_sync = 0.0
    from_end = not args.from_start

    print("GCS bridge daemon started. Press Ctrl+C to stop.", flush=True)
    print(f"Dashboard: {DASHBOARD_URL}", flush=True)

    try:
        while True:
            now = time.time()
            if now >= next_heartbeat:
                heartbeat(verbose=args.verbose)
                next_heartbeat = now + max(5, args.heartbeat_interval)
            if now >= next_sync:
                sync_logs(state, from_end=from_end)
                from_end = False
                next_sync = now + max(1, args.sync_interval)
            if now >= next_codex_sync:
                sync_codex_threads(state)
                save_state(state)
                next_codex_sync = now + 15  # poll Codex SQLite every 15s
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nGCS bridge daemon stopped.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
