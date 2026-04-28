#!/usr/bin/env python3
"""
Token tracker hook for GlobalClaudeSkills.
Reads PostToolUse JSON from stdin, estimates token usage.
Sends to dashboard API (primary) + local JSONL fallback.
"""

import json
import sys
import os
import socket
import sqlite3
import urllib.request
from datetime import datetime, date
from pathlib import Path

from gcs_env import bridge_user_agent, load_dashboard_env

load_dashboard_env()

# Fix Windows console encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

LOG_DIR      = r"d:\GlobalClaudeSkills\logs"
DAILY_THRESHOLD   = 100_000
COMPACT_THRESHOLD = 25_000
SESSION_FILE = os.path.join(os.path.dirname(__file__), ".session_tokens.tmp")

# Dashboard API config (set in env or .env)
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev")
HOOK_SECRET   = os.environ.get("HOOK_SECRET", "")
BRIDGE_TOKEN  = os.environ.get("BRIDGE_TOKEN", "")
GCS_PROVIDER  = os.environ.get("GCS_PROVIDER", "claude")
GCS_ROLE      = os.environ.get("GCS_ROLE", "")
GCS_MODEL     = os.environ.get("GCS_MODEL", "")
GCS_DEVICE_KEY = os.environ.get("GCS_DEVICE_KEY", socket.gethostname().lower())

TOOL_ESTIMATES = {
    "Read":    lambda inp: max(200, len(str(inp.get("content", ""))) // 4 + 100),
    "Write":   lambda inp: max(150, len(str(inp.get("content", ""))) // 4 + 80),
    "Edit":    lambda inp: max(100, (len(str(inp.get("old_string", ""))) + len(str(inp.get("new_string", "")))) // 4 + 80),
    "Bash":    lambda inp: 150,
    "Grep":    lambda inp: 120,
    "Glob":    lambda inp: 100,
    "Agent":   lambda inp: 2000,
    "default": lambda inp: 100,
}


def estimate_tokens(tool_name: str, tool_input: dict) -> int:
    estimator = TOOL_ESTIMATES.get(tool_name, TOOL_ESTIMATES["default"])
    try:
        return estimator(tool_input)
    except Exception:
        return 100


# ── Local fallback ─────────────────────────────────────────────────────────────

def get_log_path() -> str:
    os.makedirs(LOG_DIR, exist_ok=True)
    return os.path.join(LOG_DIR, f"global-{date.today().isoformat()}.jsonl")


def append_log_local(entry: dict):
    try:
        with open(get_log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def load_daily_total_local() -> int:
    total = 0
    try:
        with open(get_log_path(), "r", encoding="utf-8") as f:
            for line in f:
                total += json.loads(line.strip()).get("tokens", 0)
    except Exception:
        pass
    return total


# ── Dashboard API ──────────────────────────────────────────────────────────────

def post_to_dashboard(payload: dict) -> bool:
    """Fire-and-forget POST. Returns True on success, False on any error."""
    try:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "User-Agent": bridge_user_agent()}
        if BRIDGE_TOKEN:
            headers["x-bridge-token"] = BRIDGE_TOKEN
        if HOOK_SECRET:
            headers["x-hook-secret"] = HOOK_SECRET

        req = urllib.request.Request(
            f"{DASHBOARD_URL}/api/log",
            data=body,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 201
    except Exception:
        return False


# ── Session token tracking ─────────────────────────────────────────────────────

def _load_session_tokens() -> int:
    try:
        if os.path.exists(SESSION_FILE):
            return int(open(SESSION_FILE).read().strip() or "0")
    except Exception:
        pass
    return 0


def _save_session_tokens(total: int):
    try:
        open(SESSION_FILE, "w").write(str(total))
    except Exception:
        pass


# ── Codex SQLite sync (piggybacked on --session-end) ──────────────────────────

_CODEX_DB = Path.home() / ".codex" / "state_5.sqlite"
_CODEX_STATE_FILE = os.path.join(os.path.dirname(__file__), ".codex_sync_state.json")


def _load_codex_state() -> int:
    try:
        return int(json.loads(open(_CODEX_STATE_FILE).read()).get("last_ms", 0))
    except Exception:
        return 0


def _save_codex_state(last_ms: int) -> None:
    try:
        open(_CODEX_STATE_FILE, "w").write(json.dumps({"last_ms": last_ms}))
    except Exception:
        pass


def _cwd_to_project(cwd: str) -> str:
    return Path(cwd.lstrip("\\\\?\\").replace("\\", "/")).name or "local"


def sync_codex_threads() -> int:
    if not _CODEX_DB.exists():
        return 0
    last_ms = _load_codex_state()
    try:
        conn = sqlite3.connect(str(_CODEX_DB), timeout=1, check_same_thread=False)
        rows = conn.execute(
            "SELECT id, updated_at_ms, model, cwd, title, tokens_used, first_user_message "
            "FROM threads WHERE tokens_used > 0 AND updated_at_ms > ? ORDER BY updated_at_ms ASC",
            (last_ms,),
        ).fetchall()
        conn.close()
    except Exception:
        return 0

    sent = 0
    max_ms = last_ms
    for row in rows:
        thread_id, upd_ms, model, cwd, title, tokens_used, first_msg = row
        payload = {
            "type": "session",
            "project": _cwd_to_project(cwd or ""),
            "provider": "codex",
            "model": model or None,
            "date": datetime.fromtimestamp(upd_ms / 1000).isoformat(),
            "tasksCompleted": [],
            "totalTokens": int(tokens_used),
            "totalCostUSD": round(int(tokens_used) * 3.0 / 1_000_000, 6),
            "sessionNotes": title or first_msg or None,
            "risks": [],
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        if post_to_dashboard(payload):
            sent += 1
            max_ms = max(max_ms, upd_ms)
        else:
            break

    if max_ms > last_ms:
        _save_codex_state(max_ms)
    return sent


# ── Session summary (--session-end) ───────────────────────────────────────────

def session_summary():
    total = load_daily_total_local()
    tool_counts: dict[str, int] = {}
    tool_tokens: dict[str, int] = {}

    try:
        with open(get_log_path(), "r", encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line.strip())
                    t = e.get("tool", "unknown")
                    tok = e.get("tokens", 0)
                    tool_counts[t] = tool_counts.get(t, 0) + 1
                    tool_tokens[t] = tool_tokens.get(t, 0) + tok
                except Exception:
                    pass
    except Exception:
        pass

    session_total = _load_session_tokens()
    _save_session_tokens(0)

    # Push session summary to dashboard
    post_to_dashboard({
        "type": "session",
        "project": os.environ.get("GCS_PROJECT", "unknown"),
        "provider": GCS_PROVIDER,
        "role": GCS_ROLE or None,
        "model": GCS_MODEL or None,
        "deviceKey": GCS_DEVICE_KEY,
        "date": datetime.now().isoformat(),
        "tasksCompleted": [],
        "totalTokens": session_total,
        "totalCostUSD": round(session_total * 3.0 / 1_000_000, 6),
        "sessionNotes": f"Auto session summary — {date.today().isoformat()}",
        "risks": [],
    })

    print(f"\n{'='*45}")
    print(f"  Session Token Summary — {date.today().isoformat()}")
    print(f"{'='*45}")
    print(f"  This session : {session_total:,} tokens")
    print(f"  Total today  : {total:,} tokens")
    if total > DAILY_THRESHOLD:
        print(f"  WARNING: {total/DAILY_THRESHOLD*100:.0f}% of {DAILY_THRESHOLD:,} daily threshold")
    if tool_tokens:
        print(f"\n  Top token consumers:")
        for name, tok in sorted(tool_tokens.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"    {name:<20} {tok:>7,} tokens  ({tool_counts.get(name,0)}x)")
    print(f"{'='*45}\n")

    # Sync any new Codex sessions from ~/.codex/state_5.sqlite
    codex_synced = sync_codex_threads()
    if codex_synced:
        print(f"  Synced {codex_synced} Codex session(s) to dashboard.\n")


# ── Glob pattern check (--check-glob) ─────────────────────────────────────────

def check_glob_pattern():
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            return
        data = json.loads(raw)
        pattern = data.get("tool_input", {}).get("pattern", "")
        if pattern == "**/*" or (pattern.endswith("/**/*") and "." not in pattern.split("/")[-1]):
            print(f"! Broad Glob pattern: '{pattern}' — add extension filter? e.g. '**/*.ts'")
    except Exception:
        pass


# ── Main (PostToolUse hook) ────────────────────────────────────────────────────

def main():
    if "--session-end" in sys.argv:
        session_summary()
        return

    if "--check-glob" in sys.argv:
        check_glob_pattern()
        return

    try:
        raw = sys.stdin.read().strip()
        if not raw:
            return
        data = json.loads(raw)
    except Exception:
        return

    tool_name  = data.get("tool_name", data.get("tool", "unknown"))
    tool_input = data.get("tool_input", data.get("input", {}))
    tokens     = estimate_tokens(tool_name, tool_input)
    ts         = datetime.now().isoformat()

    entry = {
        "ts": ts,
        "tool": tool_name,
        "tokens": tokens,
        "provider": GCS_PROVIDER,
        "role": GCS_ROLE or None,
        "model": GCS_MODEL or None,
        "deviceKey": GCS_DEVICE_KEY,
    }

    # 1. Send to dashboard API (primary)
    sent = post_to_dashboard({"type": "tool", **entry})

    # 2. Fallback: write local file if API unreachable
    if not sent:
        append_log_local(entry)

    # Session tracking
    session_total = _load_session_tokens() + tokens
    _save_session_tokens(session_total)

    if session_total > COMPACT_THRESHOLD and (session_total - tokens) % 5000 > (session_total % 5000):
        print(f"! Context ~{session_total:,} tokens this session. Run /compact to free up.")

    # Daily budget warning (read from local fallback)
    if not sent:
        daily_total = load_daily_total_local()
        if daily_total > DAILY_THRESHOLD:
            print(f"! Token warning: {daily_total:,} tokens today (limit: {DAILY_THRESHOLD:,})")


if __name__ == "__main__":
    main()
