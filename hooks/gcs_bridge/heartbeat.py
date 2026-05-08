"""Heartbeat payload builder for the local GCS bridge."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Callable

from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.command_utils import command_available, command_path

import json
import urllib.request
import os

def get_gemini_models() -> list[str]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return []
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode())
            models = data.get("models", [])
            return [m["name"].replace("models/", "") for m in models if "generateContent" in m.get("supportedGenerationMethods", [])]
    except Exception:
        return []


IdentityProvider = Callable[[], dict[str, str]]
ProjectPathProvider = Callable[[], list[dict[str, str]]]


def send_heartbeat(
    client: BridgeClient,
    bridge_token: str,
    hook_secret: str,
    identity_provider: IdentityProvider,
    project_paths_provider: ProjectPathProvider,
    *,
    verbose: bool = False,
    runner: str = "hooks/gcs_bridge_daemon.py",
) -> bool:
    if not bridge_token and not hook_secret:
        print("BRIDGE_TOKEN or HOOK_SECRET is not set; bridge cannot authenticate.", flush=True)
        return False

    identity = identity_provider()
    device_key = identity["deviceKey"]
    device_name = identity["deviceName"]
    ok, detail = client.post_json(
        "/api/bridge/heartbeat",
        {
            "deviceKey": device_key,
            "name": device_name,
            "claudeAvailable": command_available("claude"),
            "codexAvailable": command_available("codex"),
            "geminiAvailable": command_available("gemini"),
            "reportedModels": {
                "gemini": get_gemini_models()
            },
            "projectPaths": project_paths_provider(),
            "metadata": {
                "cwd": os.getcwd(),
                "runner": runner,
                "startedAt": datetime.now().isoformat(),
                "claudePath": command_path("claude"),
                "codexPath": command_path("codex"),
                "geminiPath": command_path("gemini"),
            },
        },
    )
    if verbose or not ok:
        print(f"[heartbeat] {'ok' if ok else 'failed'} {str(detail)[:160]}", flush=True)
    return ok
