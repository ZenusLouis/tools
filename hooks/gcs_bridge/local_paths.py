"""Local project path registry for multi-device bridge sync."""

from __future__ import annotations

import json
from pathlib import Path


def collect_project_paths(projects_dir: Path, registry_path: Path) -> list[dict[str, str]]:
    """Read local GCS project contexts and report source folders known to this device."""
    by_name: dict[str, str] = {}
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for project_name, project_path in data.items():
                if isinstance(project_name, str) and isinstance(project_path, str) and project_name and project_path:
                    by_name[project_name] = project_path
    except Exception:
        pass

    if not projects_dir.exists():
        return [{"projectName": name, "path": path} for name, path in sorted(by_name.items())]

    for context_path in projects_dir.glob("*/context.json"):
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


def remember_project_path(registry_path: Path, project_name: str, project_path: str) -> None:
    if not project_name or not project_path:
        return
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else {}
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    data[project_name] = project_path
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = registry_path.with_suffix(f"{registry_path.suffix}.tmp")
    tmp_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(registry_path)

