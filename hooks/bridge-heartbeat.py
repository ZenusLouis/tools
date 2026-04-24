#!/usr/bin/env python3
"""Report local Claude/Codex availability to the GCS dashboard bridge API."""

import json
import os
import shutil
import socket
import urllib.request

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")


def main():
    if not BRIDGE_TOKEN:
        print("BRIDGE_TOKEN is not set")
        return

    payload = {
        "deviceKey": os.environ.get("GCS_DEVICE_KEY", socket.gethostname().lower()),
        "name": os.environ.get("GCS_DEVICE_NAME", socket.gethostname()),
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
        headers={"Content-Type": "application/json", "x-bridge-token": BRIDGE_TOKEN},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(resp.read().decode("utf-8"))


if __name__ == "__main__":
    main()
