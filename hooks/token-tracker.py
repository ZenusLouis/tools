#!/usr/bin/env python3
"""
Token tracker hook for GlobalClaudeSkills.
Reads PostToolUse JSON from stdin, estimates token usage, logs to JSONL.
Run with --session-end to print daily summary.
Run with --check-glob to warn on overly broad Glob patterns.
"""

import json
import sys
import os
from datetime import datetime, date

# Fix Windows console encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

LOG_DIR = r"d:\GlobalClaudeSkills\logs"
DAILY_THRESHOLD = 100_000
COMPACT_THRESHOLD = 25_000  # suggest /compact per CONVERSATION session
SESSION_FILE = os.path.join(os.path.dirname(__file__), ".session_tokens.tmp")

# Rough token estimates per tool type (input + output combined)
TOOL_ESTIMATES = {
    "Read": lambda inp: max(200, len(str(inp.get("content", ""))) // 4 + 100),
    "Write": lambda inp: max(150, len(str(inp.get("content", ""))) // 4 + 80),
    "Edit": lambda inp: max(100, (len(str(inp.get("old_string", ""))) + len(str(inp.get("new_string", "")))) // 4 + 80),
    "Bash": lambda inp: 150,
    "Grep": lambda inp: 120,
    "Glob": lambda inp: 100,
    "Agent": lambda inp: 2000,  # subagent calls are expensive
    "default": lambda inp: 100,
}


def estimate_tokens(tool_name: str, tool_input: dict) -> int:
    estimator = TOOL_ESTIMATES.get(tool_name, TOOL_ESTIMATES["default"])
    try:
        return estimator(tool_input)
    except Exception:
        return 100


def get_log_path() -> str:
    os.makedirs(LOG_DIR, exist_ok=True)
    return os.path.join(LOG_DIR, f"global-{date.today().isoformat()}.jsonl")


def load_daily_total() -> int:
    log_path = get_log_path()
    if not os.path.exists(log_path):
        return 0
    total = 0
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                entry = json.loads(line.strip())
                total += entry.get("tokens", 0)
    except Exception:
        pass
    return total


def append_log(entry: dict):
    log_path = get_log_path()
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _load_session_tokens() -> int:
    try:
        if os.path.exists(SESSION_FILE):
            with open(SESSION_FILE, "r") as f:
                return int(f.read().strip() or "0")
    except Exception:
        pass
    return 0


def _save_session_tokens(total: int):
    try:
        with open(SESSION_FILE, "w") as f:
            f.write(str(total))
    except Exception:
        pass


def session_summary():
    total = load_daily_total()
    log_path = get_log_path()
    tool_counts: dict[str, int] = {}
    tool_tokens: dict[str, int] = {}

    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line.strip())
                    t = e.get("tool", "unknown")
                    tok = e.get("tokens", 0)
                    tool_counts[t] = tool_counts.get(t, 0) + 1
                    tool_tokens[t] = tool_tokens.get(t, 0) + tok
                except Exception:
                    pass

    session_total = _load_session_tokens()
    # Reset session counter on session end
    _save_session_tokens(0)

    print(f"\n{'='*45}")
    print(f"  Session Token Summary — {date.today().isoformat()}")
    print(f"{'='*45}")
    print(f"  This session: {session_total:,} tokens")
    print(f"  Total today:  {total:,} tokens")
    if total > DAILY_THRESHOLD:
        pct = total / DAILY_THRESHOLD * 100
        print(f"  WARNING: {pct:.0f}% of {DAILY_THRESHOLD:,} daily threshold")

    if tool_tokens:
        top = sorted(tool_tokens.items(), key=lambda x: x[1], reverse=True)[:5]
        print(f"\n  Top token consumers:")
        for name, tok in top:
            count = tool_counts.get(name, 0)
            print(f"    {name:<20} {tok:>7,} tokens  ({count}x)")
    print(f"{'='*45}\n")


def check_glob_pattern():
    """Warn on overly broad Glob patterns (PreToolUse hook)."""
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            return
        data = json.loads(raw)
        pattern = data.get("tool_input", {}).get("pattern", "")
        if pattern == "**/*" or (pattern.endswith("/**/*") and "." not in pattern.split("/")[-1]):
            print(f"! Broad Glob pattern: '{pattern}' may match thousands of files. "
                  f"Add extension filter? e.g., '**/*.ts' or '**/*.py'")
    except Exception:
        pass


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

    tool_name = data.get("tool_name", data.get("tool", "unknown"))
    tool_input = data.get("tool_input", data.get("input", {}))

    tokens = estimate_tokens(tool_name, tool_input)

    entry = {
        "ts": datetime.now().isoformat(),
        "tool": tool_name,
        "tokens": tokens,
    }
    append_log(entry)

    # Track CONVERSATION tokens separately (reset on session-end, not daily)
    session_total = _load_session_tokens() + tokens
    _save_session_tokens(session_total)

    # Suggest /compact at 25k conversation tokens
    if session_total > COMPACT_THRESHOLD and (session_total - tokens) % 5000 > (session_total % 5000):
        print(f"! Context ~{session_total:,} tokens this session. Run /compact to free up.")

    # Daily budget warning
    daily_total = load_daily_total()
    if daily_total > DAILY_THRESHOLD:
        print(f"! Token warning: {daily_total:,} tokens today (limit: {DAILY_THRESHOLD:,})")


if __name__ == "__main__":
    main()
