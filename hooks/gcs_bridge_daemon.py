#!/usr/bin/env python3
"""Long-running local GCS bridge daemon.

Keeps the local bridge online and syncs new JSONL log lines to the dashboard.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env, local_device_identity


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
LOG_DIR = ROOT / "logs"
STATE_PATH = ROOT / "hooks" / ".gcs_bridge_state.json"
PROJECTS_DIR = ROOT / "projects"
LOCAL_PROJECT_PATHS = ROOT / "hooks" / ".gcs_project_paths.json"


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


def post_json_data(path: str, payload: dict, timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
    ok, body = post_json(path, payload, timeout=timeout)
    if not ok:
        return False, body
    try:
        data = json.loads(body)
    except Exception:
        return False, body
    if not isinstance(data, dict):
        return False, body
    return True, data


def collect_project_paths() -> list[dict[str, str]]:
    """Read local GCS project contexts and report source folders known to this device."""
    by_name: dict[str, str] = {}
    try:
        data = json.loads(LOCAL_PROJECT_PATHS.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for project_name, project_path in data.items():
                if isinstance(project_name, str) and isinstance(project_path, str) and project_name and project_path:
                    by_name[project_name] = project_path
    except Exception:
        pass

    if not PROJECTS_DIR.exists():
        return [{"projectName": name, "path": path} for name, path in sorted(by_name.items())]

    for context_path in PROJECTS_DIR.glob("*/context.json"):
        try:
            data = json.loads(context_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        project_name = str(data.get("name") or context_path.parent.name).strip()
        project_path = str(data.get("path") or "").strip()
        if project_name and project_path:
            by_name[project_name] = project_path
    return [{"projectName": name, "path": path} for name, path in sorted(by_name.items())]


def remember_project_path(project_name: str, project_path: str) -> None:
    if not project_name or not project_path:
        return
    try:
        data = json.loads(LOCAL_PROJECT_PATHS.read_text(encoding="utf-8")) if LOCAL_PROJECT_PATHS.exists() else {}
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    data[project_name] = project_path
    LOCAL_PROJECT_PATHS.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = LOCAL_PROJECT_PATHS.with_suffix(f"{LOCAL_PROJECT_PATHS.suffix}.tmp")
    tmp_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(LOCAL_PROJECT_PATHS)


def heartbeat(verbose: bool) -> bool:
    if not BRIDGE_TOKEN and not HOOK_SECRET:
        print("BRIDGE_TOKEN or HOOK_SECRET is not set; bridge cannot authenticate.", flush=True)
        return False

    identity = local_device_identity()
    device_key = identity["deviceKey"]
    device_name = identity["deviceName"]
    ok, detail = post_json(
        "/api/bridge/heartbeat",
        {
            "deviceKey": device_key,
            "name": device_name,
            "claudeAvailable": shutil.which("claude") is not None,
            "codexAvailable": shutil.which("codex") is not None,
            "projectPaths": collect_project_paths(),
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
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STATE_PATH.with_suffix(f"{STATE_PATH.suffix}.tmp")
    tmp_path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(STATE_PATH)


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


def _should_backfill_existing_codex_thread(updated_at_ms: int) -> bool:
    if CODEX_SYNC_EXISTING:
        return True
    updated_at = datetime.fromtimestamp(updated_at_ms / 1000)
    now = datetime.now()
    return updated_at.date() == now.date()


def _codex_token_keys(thread_id: str, updated_at_ms: int) -> tuple[str, str]:
    """Return legacy thread key plus a daily key for date-scoped token deltas."""
    updated_at = datetime.fromtimestamp(updated_at_ms / 1000)
    day_key = updated_at.strftime("%Y-%m-%d")
    legacy_key = f"__codex_thread_tokens__:{thread_id}"
    daily_key = f"__codex_thread_tokens__:{thread_id}:{day_key}"
    return legacy_key, daily_key


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
        legacy_token_key, daily_token_key = _codex_token_keys(row["id"], row["updated_at_ms"])
        previous_tokens = state.get(daily_token_key)
        legacy_previous_tokens = state.get(legacy_token_key)
        current_tokens = int(row["tokens_used"] or 0)
        if previous_tokens is None:
            if legacy_previous_tokens is not None:
                previous_tokens = legacy_previous_tokens
                state[daily_token_key] = legacy_previous_tokens

            if not _should_backfill_existing_codex_thread(row["updated_at_ms"]):
                state[daily_token_key] = current_tokens
                state[legacy_token_key] = current_tokens
                max_ms = max(max_ms, row["updated_at_ms"])
                continue

            delta_tokens = current_tokens if previous_tokens is None else max(0, current_tokens - previous_tokens)
        else:
            delta_tokens = max(0, current_tokens - previous_tokens)
            if delta_tokens <= 0:
                state[daily_token_key] = current_tokens
                state[legacy_token_key] = current_tokens
                max_ms = max(max_ms, row["updated_at_ms"])
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
            "deviceKey": local_device_identity()["deviceKey"],
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
            state[daily_token_key] = current_tokens
            state[legacy_token_key] = current_tokens
            max_ms = max(max_ms, row["updated_at_ms"])
            sent += 1
        else:
            print(f"[codex-sync] failed thread {row['id'][:8]}: {detail[:120]}", flush=True)
            break

    if max_ms > last_ms:
        state[CODEX_STATE_KEY] = max_ms
    if sent:
        print(f"[codex-sync] synced {sent} Codex thread(s)", flush=True)
    return sent


def _safe_local_target(project_path: str, relative_path: str) -> Path:
    if not project_path:
        raise ValueError("projectPath is required")
    rel = Path(relative_path)
    if rel.is_absolute() or ".." in rel.parts:
        raise ValueError(f"unsafe relativePath: {relative_path}")
    base = Path(project_path).expanduser().resolve()
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise ValueError(f"target escapes projectPath: {relative_path}") from exc
    return target


def execute_file_action(action: dict[str, Any]) -> dict[str, Any]:
    action_type = str(action.get("type") or "")
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}

    if action_type != "sync_project_metadata":
        raise ValueError(f"unsupported file action type: {action_type}")

    project_path = str(payload.get("projectPath") or "")
    project_name = str(payload.get("projectName") or "")
    files = payload.get("files")
    if not isinstance(files, list):
        raise ValueError("payload.files must be a list")

    written: list[str] = []
    for item in files:
        if not isinstance(item, dict):
            continue
        relative_path = str(item.get("relativePath") or "")
        content = item.get("content")
        if not relative_path or not isinstance(content, str):
            continue
        target = _safe_local_target(project_path, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        written.append(str(target))

    remember_project_path(project_name, project_path)
    return {"written": written, "count": len(written)}


def poll_file_actions() -> int:
    device_key = local_device_identity()["deviceKey"]
    ok, data = post_json_data("/api/bridge/file-actions/pending", {"deviceKey": device_key, "limit": 5}, timeout=8)
    if not ok:
        print(f"[file-actions] poll failed: {str(data)[:160]}", flush=True)
        return 0

    actions = data.get("actions") if isinstance(data, dict) else []
    if not isinstance(actions, list) or not actions:
        return 0

    completed = 0
    for action in actions:
        if not isinstance(action, dict) or not action.get("id"):
            continue
        action_id = str(action["id"])
        try:
            result = execute_file_action(action)
            ok, detail = post_json_data(
                "/api/bridge/file-actions/result",
                {"id": action_id, "status": "succeeded", "deviceKey": device_key, "result": result},
                timeout=8,
            )
            if ok:
                completed += 1
                print(f"[file-actions] completed {action_id}: {result.get('count', 0)} file(s)", flush=True)
            else:
                print(f"[file-actions] result failed {action_id}: {str(detail)[:160]}", flush=True)
        except Exception as exc:
            post_json_data(
                "/api/bridge/file-actions/result",
                {"id": action_id, "status": "failed", "deviceKey": device_key, "error": str(exc)},
                timeout=8,
            )
            print(f"[file-actions] failed {action_id}: {exc}", flush=True)
    return completed


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
    next_file_action_poll = 0.0
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
            if now >= next_file_action_poll:
                poll_file_actions()
                next_file_action_poll = now + 5
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nGCS bridge daemon stopped.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
