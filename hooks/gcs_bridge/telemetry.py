"""Telemetry state and JSONL log sync for the local bridge."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from gcs_bridge.bridge_client import BridgeClient


def load_state(state_path: Path) -> dict[str, int]:
    if not state_path.exists():
        return {}
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): int(value) for key, value in data.items() if isinstance(value, int)}


def save_state(state_path: Path, state: dict[str, int]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = state_path.with_suffix(f"{state_path.suffix}.tmp")
    tmp_path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(state_path)


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


def sync_log_file(client: BridgeClient, path: Path, state: dict[str, int], from_end: bool) -> int:
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
            ok, detail = client.post_json("/api/log", payload, timeout=5)
            if ok:
                sent += 1
            else:
                print(f"[sync] failed {path.name}: {str(detail)[:160]}", flush=True)
                break
        state[key] = handle.tell()
    return sent


def sync_logs(client: BridgeClient, log_dir: Path, state_path: Path, state: dict[str, int], from_end: bool) -> int:
    log_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(log_dir.glob("global-*.jsonl")):
        total += sync_log_file(client, path, state, from_end=from_end)
    save_state(state_path, state)
    if total:
        print(f"[sync] sent {total} log entr{'y' if total == 1 else 'ies'}", flush=True)
    return total
