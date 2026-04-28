#!/usr/bin/env python3
"""Report local Claude/Codex availability to the GCS dashboard bridge API."""

import json
import os
import shutil
import urllib.request

from gcs_env import bridge_user_agent, load_dashboard_env, local_device_identity

load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")


def main():
    if not BRIDGE_TOKEN and not HOOK_SECRET:
        print("BRIDGE_TOKEN or HOOK_SECRET is not set")
        return

    identity = local_device_identity()
    payload = {
        "deviceKey": identity["deviceKey"],
        "name": identity["deviceName"],
        "claudeAvailable": shutil.which("claude") is not None,
        "codexAvailable": shutil.which("codex") is not None,
        "metadata": {
            "cwd": os.getcwd(),
            "platform": os.name,
        },
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{DASHBOARD_URL}/api/bridge/heartbeat",
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": bridge_user_agent(),
            **({"x-bridge-token": BRIDGE_TOKEN} if BRIDGE_TOKEN else {}),
            **({"x-hook-secret": HOOK_SECRET} if HOOK_SECRET else {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(resp.read().decode("utf-8"))


if __name__ == "__main__":
    main()
