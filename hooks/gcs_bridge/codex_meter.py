"""Codex local SQLite token/credit meter sync."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Callable

from gcs_bridge.bridge_client import BridgeClient


CODEX_STATE_DB = Path.home() / ".codex" / "state_5.sqlite"
CODEX_STATE_KEY = "__codex_last_updated_at_ms__"
CODEX_SYNC_EXISTING = os.environ.get("GCS_CODEX_SYNC_EXISTING", "").lower() in {"1", "true", "yes"}


def project_from_cwd(cwd: str) -> str:
    clean = cwd.lstrip("\\\\?\\").replace("\\", "/")
    return Path(clean).name or "local"


def should_backfill_existing_codex_thread(_updated_at_ms: int) -> bool:
    return CODEX_SYNC_EXISTING


def codex_token_keys(thread_id: str, updated_at_ms: int) -> tuple[str, str]:
    updated_at = datetime.fromtimestamp(updated_at_ms / 1000)
    day_key = updated_at.strftime("%Y-%m-%d")
    legacy_key = f"__codex_thread_tokens__:{thread_id}"
    daily_key = f"__codex_thread_tokens__:{thread_id}:{day_key}"
    return legacy_key, daily_key


def sync_codex_threads(
    client: BridgeClient,
    state: dict[str, int],
    *,
    database_path: Path = CODEX_STATE_DB,
    project_from_cwd_fn: Callable[[str], str] = project_from_cwd,
    device_identity_fn: Callable[[], dict[str, str]] | None = None,
) -> int:
    if not database_path.exists():
        return 0
    last_ms = state.get(CODEX_STATE_KEY, 0)
    try:
        conn = sqlite3.connect(str(database_path), timeout=1, check_same_thread=False)
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
        legacy_token_key, daily_token_key = codex_token_keys(row["id"], row["updated_at_ms"])
        previous_tokens = state.get(daily_token_key)
        legacy_previous_tokens = state.get(legacy_token_key)
        current_tokens = int(row["tokens_used"] or 0)
        if previous_tokens is None:
            if legacy_previous_tokens is not None:
                previous_tokens = legacy_previous_tokens
                state[daily_token_key] = legacy_previous_tokens

            if previous_tokens is None and not should_backfill_existing_codex_thread(row["updated_at_ms"]):
                state[daily_token_key] = current_tokens
                state[legacy_token_key] = current_tokens
                max_ms = max(max_ms, row["updated_at_ms"])
                continue

        delta_tokens = current_tokens - int(previous_tokens or 0)
        state[daily_token_key] = current_tokens
        state[legacy_token_key] = current_tokens
        max_ms = max(max_ms, row["updated_at_ms"])
        if delta_tokens <= 0:
            continue

        event_date = datetime.fromtimestamp(row["updated_at_ms"] / 1000).isoformat()
        title = str(row["title"] or row["first_user_message"] or "Codex IDE session").strip()
        cwd = str(row["cwd"] or "")
        project = project_from_cwd_fn(cwd)
        device_key = (device_identity_fn() or {}).get("deviceKey") if device_identity_fn else None
        tool_payload = {
            "type": "tool",
            "ts": event_date,
            "tool": "codex-thread",
            "tokens": delta_tokens,
            "provider": "codex",
            "role": os.environ.get("GCS_ROLE") or "dev-implementer",
            "model": row["model"] or os.environ.get("GCS_MODEL") or "codex",
            "project": project,
            "cwd": cwd,
            "deviceKey": device_key,
            "metadata": {
                "threadId": row["id"],
                "title": title[:240],
                "meter": "daily-thread-delta",
                "totalThreadTokens": current_tokens,
            },
        }
        ok, detail = client.post_json("/api/log", {k: v for k, v in tool_payload.items() if v is not None}, timeout=5)
        if ok:
            sent += 1
        else:
            print(f"[codex-sync] failed {str(row['id'])[:8]}: {str(detail)[:160]}", flush=True)
            break

        session_key = f"__codex_thread_session__:{row['id']}:{row['updated_at_ms']}"
        if not state.get(session_key):
            payload = {
                "type": "session",
                "project": project,
                "provider": "codex",
                "role": os.environ.get("GCS_ROLE") or "dev-implementer",
                "model": row["model"] or os.environ.get("GCS_MODEL") or "codex",
                "date": event_date,
                "cwd": cwd,
                "deviceKey": device_key,
                "durationMin": None,
                "totalTokens": delta_tokens,
                "totalCostUSD": 0,
                "sessionNotes": f"Codex IDE thread update: {title[:180]}",
                "risks": [],
                "metadata": {
                    "threadId": row["id"],
                    "meter": "daily-thread-delta",
                    "totalThreadTokens": current_tokens,
                },
            }
            ok, detail = client.post_json("/api/log", payload, timeout=5)
            if ok:
                state[session_key] = 1
            else:
                print(f"[codex-sync] session failed {str(row['id'])[:8]}: {str(detail)[:160]}", flush=True)

    if max_ms > last_ms:
        state[CODEX_STATE_KEY] = max_ms
    if sent:
        print(f"[codex-sync] sent {sent} Codex thread update(s)", flush=True)
    return sent
