"""Small env loader for local GCS hook scripts."""

from __future__ import annotations

import os
import json
import socket
import uuid
from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SETTINGS_FILES = (
    ROOT / ".codex" / "settings.json",
    ROOT / ".codex" / "settings.local.json",
)
DEVICE_IDENTITY_PATH = ROOT / "hooks" / ".gcs_device.json"


def _clean(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def _deep_merge(left: dict, right: dict) -> dict:
    merged = {**left}
    for key, value in right.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_codex_settings() -> dict:
    settings: dict = {}
    for settings_path in DEFAULT_SETTINGS_FILES:
        if not settings_path.exists():
            continue
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(data, dict):
            settings = _deep_merge(settings, data)
    return settings


def bridge_user_agent() -> str:
    settings = load_codex_settings()
    value = settings.get("bridge", {}).get("userAgent")
    return str(value) if value else "GCS-Local-Bridge/1.0"


def bridge_token_hash() -> str:
    token = os.environ.get("BRIDGE_TOKEN", "")
    return sha256(token.encode("utf-8")).hexdigest() if token else "anonymous"


def local_device_identity() -> dict[str, str]:
    """Return a stable per-account local device identity without machine env vars.

    The bridge token scopes the device to the logged-in account/workspace.
    The generated device key is local-only and gitignored, so different machines
    using the same account still register as separate devices.
    """
    token_hash = bridge_token_hash()
    try:
        if DEVICE_IDENTITY_PATH.exists():
            data = json.loads(DEVICE_IDENTITY_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("tokenHash") == token_hash:
                device_key = str(data.get("deviceKey") or "")
                device_name = str(data.get("deviceName") or "")
                if device_key and device_name:
                    return {"deviceKey": device_key, "deviceName": device_name}
    except Exception:
        pass

    suffix = uuid.uuid4().hex[:10]
    host_hint = socket.gethostname() or "local"
    identity = {
        "deviceKey": f"gcs-local-{token_hash[:10]}-{suffix}",
        "deviceName": f"Local Bridge {host_hint}",
        "tokenHash": token_hash,
    }
    try:
        DEVICE_IDENTITY_PATH.parent.mkdir(parents=True, exist_ok=True)
        DEVICE_IDENTITY_PATH.write_text(json.dumps(identity, indent=2), encoding="utf-8")
    except Exception:
        pass
    return {"deviceKey": identity["deviceKey"], "deviceName": identity["deviceName"]}


def _env_files(settings: dict) -> list[Path]:
    configured = settings.get("dashboard", {}).get("envFiles")
    if not isinstance(configured, list):
        configured = ["apps/dashboard/.env.local", "apps/dashboard/.env"]
    return [ROOT / item for item in configured if isinstance(item, str)]


def load_dashboard_env() -> None:
    """Populate missing process env values from Codex settings and dashboard env files."""
    settings = load_codex_settings()

    dashboard_url = settings.get("dashboard", {}).get("url")
    if dashboard_url and "DASHBOARD_URL" not in os.environ:
        os.environ["DASHBOARD_URL"] = str(dashboard_url)

    env = settings.get("env", {})
    if isinstance(env, dict):
        for key, value in env.items():
            if isinstance(key, str) and key and value is not None and key not in os.environ:
                os.environ[key] = str(value)

    agent = settings.get("agent", {})
    defaults = {
        "GCS_PROVIDER": agent.get("provider"),
        "GCS_PROJECT": agent.get("defaultProject"),
        "GCS_ROLE": agent.get("defaultRole"),
        "GCS_MODEL": agent.get("defaultModel"),
    }
    for key, value in defaults.items():
        if value and key not in os.environ:
            os.environ[key] = str(value)

    for env_path in _env_files(settings):
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = _clean(value)
