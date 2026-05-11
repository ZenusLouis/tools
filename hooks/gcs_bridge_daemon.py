#!/usr/bin/env python3
"""Long-running local GCS bridge daemon.

Keeps the local bridge online and syncs new JSONL log lines to the dashboard.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env, local_device_identity
from gcs_bridge.action_lifecycle import ActionLifecycle
from gcs_bridge.action_runner import FileActionPoller
from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.codex_meter import sync_codex_threads as sync_codex_meter_threads
from gcs_bridge.heartbeat import send_heartbeat
from gcs_bridge.local_action_executor import configure as configure_action_executor
from gcs_bridge.local_action_executor import execute_file_action
from gcs_bridge.local_paths import collect_project_paths as collect_local_project_paths
from gcs_bridge.local_paths import remember_project_path as remember_local_project_path
from gcs_bridge.telemetry import load_state as load_bridge_state
from gcs_bridge.telemetry import save_state as save_bridge_state
from gcs_bridge.telemetry import sync_logs as sync_jsonl_logs


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
LOG_DIR = ROOT / "logs"
STATE_PATH = ROOT / "hooks" / ".gcs_bridge_state.json"
PROJECTS_DIR = ROOT / "projects"
LOCAL_PROJECT_PATHS = ROOT / "hooks" / ".gcs_project_paths.json"
CLIENT = BridgeClient(DASHBOARD_URL, BRIDGE_TOKEN, HOOK_SECRET, bridge_user_agent)
ACTION_LIFECYCLE = ActionLifecycle(CLIENT)

def post_json_data(path: str, payload: dict, timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
    return CLIENT.post_json_data(path, payload, timeout=timeout)


post_action_progress = ACTION_LIFECYCLE.post_progress
refresh_action_lease = ACTION_LIFECYCLE.refresh_lease
is_action_cancelled = ACTION_LIFECYCLE.is_cancelled


def collect_project_paths() -> list[dict[str, str]]:
    return collect_local_project_paths(PROJECTS_DIR, LOCAL_PROJECT_PATHS)


def remember_project_path(project_name: str, project_path: str) -> None:
    remember_local_project_path(LOCAL_PROJECT_PATHS, project_name, project_path)


def heartbeat(verbose: bool) -> bool:
    return send_heartbeat(
        CLIENT,
        BRIDGE_TOKEN,
        HOOK_SECRET,
        local_device_identity,
        collect_project_paths,
        verbose=verbose,
    )


def load_state() -> dict[str, int]:
    return load_bridge_state(STATE_PATH)


def save_state(state: dict[str, int]) -> None:
    save_bridge_state(STATE_PATH, state)


def sync_codex_threads(state: dict[str, int]) -> int:
    return sync_codex_meter_threads(CLIENT, state, device_identity_fn=local_device_identity)


configure_action_executor(
    root=ROOT,
    post_json_data_fn=post_json_data,
    post_action_progress_fn=post_action_progress,
    refresh_action_lease_fn=refresh_action_lease,
    is_action_cancelled_fn=is_action_cancelled,
    heartbeat_fn=heartbeat,
    remember_project_path_fn=remember_project_path,
)


def poll_file_actions() -> int:
    return FileActionPoller(CLIENT, local_device_identity, execute_file_action).poll(limit=5)


def sync_logs(state: dict[str, int], from_end: bool) -> int:
    return sync_jsonl_logs(CLIENT, LOG_DIR, STATE_PATH, state, from_end=from_end)


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

    # Auto-reload: track own script + gcs_bridge package mtimes
    _self = Path(__file__).resolve()
    def _watched_mtimes() -> dict[str, float]:
        mtimes: dict[str, float] = {str(_self): _self.stat().st_mtime}
        pkg = _self.parent / "gcs_bridge"
        if pkg.is_dir():
            for f in pkg.rglob("*.py"):
                try:
                    mtimes[str(f)] = f.stat().st_mtime
                except Exception:
                    pass
        return mtimes
    _watch_mtimes = _watched_mtimes()

    print("GCS bridge daemon started. Press Ctrl+C to stop.", flush=True)
    print(f"Dashboard: {DASHBOARD_URL}", flush=True)

    try:
        while True:
            now = time.time()

            # Auto-reload check: watch own script + gcs_bridge package
            try:
                new_mtimes = _watched_mtimes()
                if new_mtimes != _watch_mtimes:
                    changed = [f for f in new_mtimes if new_mtimes.get(f) != _watch_mtimes.get(f)]
                    print(f"[auto-reload] Changed: {', '.join(Path(f).name for f in changed)} — restarting...", flush=True)
                    save_state(state)
                    os.execv(sys.executable, [sys.executable] + sys.argv)
            except Exception:
                pass

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
                next_codex_sync = now + 15
            if now >= next_file_action_poll:
                poll_file_actions()
                next_file_action_poll = now + 5
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nGCS bridge daemon stopped.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
