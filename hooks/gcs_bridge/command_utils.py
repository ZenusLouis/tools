"""Command discovery helpers for local bridge runners."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def command_path(command: str) -> str | None:
    """Resolve an executable from configured env vars or PATH."""
    configured_keys = (f"GCS_{command.upper()}_BIN", f"{command.upper()}_BIN")
    for env_key in configured_keys:
        configured = os.environ.get(env_key)
        if configured and Path(configured).exists():
            return configured

    resolved = shutil.which(command)
    if resolved:
        return resolved

    if os.name == "nt":
        try:
            result = subprocess.run(
                ["where.exe", command],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=5,
            )
            if result.returncode == 0:
                first = next((line.strip() for line in result.stdout.splitlines() if line.strip()), "")
                if first:
                    return first
        except Exception:
            pass
    return None


def command_available(command: str) -> bool:
    return command_path(command) is not None
