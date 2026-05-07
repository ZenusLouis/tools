"""Task artifact, progress snapshot, and local path helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable


PostJsonData = Callable[[str, dict[str, Any], int], tuple[bool, dict[str, Any] | str]]


def safe_local_target(project_path: str, relative_path: str) -> Path:
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


def safe_task_slug(task_id: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in task_id)[:160] or "task"


def safe_artifact_path(project_path: str, task_id: str, phase: str) -> Path:
    filename = "review.md" if phase == "review" else "brief.md" if phase == "analysis" else "implementation.md"
    return safe_local_target(project_path, f".gcs/tasks/{safe_task_slug(task_id)}/{filename}")


def safe_task_file(project_path: str, task_id: str, filename: str) -> Path:
    return safe_local_target(project_path, f".gcs/tasks/{safe_task_slug(task_id)}/{filename}")


def post_task_event(
    post_json_data: PostJsonData,
    task_id: str,
    phase: str,
    status: str,
    provider: str,
    role: str,
    note: str,
) -> None:
    post_json_data(
        "/api/bridge/task-event",
        {
            "taskId": task_id,
            "phase": phase,
            "status": status,
            "provider": provider,
            "role": role or None,
            "note": note,
        },
        8,
    )


def post_task_artifact(
    post_json_data: PostJsonData,
    project: str,
    task_id: str,
    kind: str,
    path: str,
    content: str,
) -> None:
    post_json_data(
        "/api/bridge/artifact",
        {
            "project": project,
            "taskId": task_id,
            "kind": kind,
            "path": path,
            "content": content[:200000],
        },
        8,
    )


def ensure_global_ignore(project_path: Path) -> None:
    """Ensure a standard .claudeignore file exists in the project to save tokens."""
    ignore_path = project_path / ".claudeignore"
    patterns = [
        "# GCS Global Ignore Patterns",
        "node_modules/",
        "dist/",
        "build/",
        ".next/",
        "out/",
        "target/",
        "bin/",
        "obj/",
        "*.log",
        ".turbo/",
        ".cache/",
        "npm-debug.log*",
        ".env*",
        "*.pem",
        "*.key",
        ".gcs/tasks/",
    ]

    if not ignore_path.exists():
        try:
            ignore_path.write_text("\n".join(patterns) + "\n", encoding="utf-8")
            print(f"[bridge] Created global .claudeignore at {ignore_path}", flush=True)
        except Exception as exc:
            print(f"[bridge] Warning: failed to create .claudeignore: {exc}", flush=True)
        return

    try:
        content = ignore_path.read_text(encoding="utf-8", errors="replace")
        if "node_modules/" not in content:
            with ignore_path.open("a", encoding="utf-8") as handle:
                handle.write("\n\n# GCS Global Additions\n" + "\n".join(patterns[1:]) + "\n")
            print(f"[bridge] Appended global ignore patterns to {ignore_path}", flush=True)
    except Exception:
        pass


def sync_task_to_progress(root: Path, project_name: str, payload: dict[str, Any]) -> None:
    """Upsert task details from bridge action payload into the hub's progress.json snapshot."""
    task_data = payload.get("task")
    if not isinstance(task_data, dict):
        return
    task_id = str(task_data.get("id") or payload.get("taskId") or "")
    if not task_id:
        return

    progress_path = root / "projects" / project_name / "progress.json"
    try:
        progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else {}
    except Exception:
        progress = {}

    if not isinstance(progress, dict):
        progress = {}
    progress.setdefault("project", project_name)
    progress.setdefault("modules", [])

    module_name = str(task_data.get("moduleName") or "")
    feature_name = str(task_data.get("featureName") or "")

    module_entry = next((m for m in progress["modules"] if m.get("name") == module_name), None)
    if not module_entry:
        module_entry = {"name": module_name, "features": []}
        progress["modules"].append(module_entry)
    module_entry.setdefault("features", [])

    feature_entry = next((f for f in module_entry["features"] if f.get("name") == feature_name), None)
    if not feature_entry:
        feature_entry = {"name": feature_name, "tasks": []}
        module_entry["features"].append(feature_entry)
    feature_entry.setdefault("tasks", [])

    existing = next((t for t in feature_entry["tasks"] if t.get("id") == task_id), None)
    task_entry = {
        "id": task_id,
        "name": str(task_data.get("name") or ""),
        "summary": str(task_data.get("summary") or ""),
        "details": str(task_data.get("details") or ""),
        "acceptanceCriteria": task_data.get("acceptanceCriteria") or [],
        "steps": task_data.get("steps") or [],
        "status": "pending",
    }
    if existing:
        existing.update(task_entry)
    else:
        feature_entry["tasks"].append(task_entry)

    try:
        progress_path.parent.mkdir(parents=True, exist_ok=True)
        progress_path.write_text(json.dumps(progress, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass
