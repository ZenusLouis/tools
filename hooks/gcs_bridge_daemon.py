#!/usr/bin/env python3
"""Long-running local GCS bridge daemon.

Keeps the local bridge online and syncs new JSONL log lines to the dashboard.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import subprocess
import sys
import threading
import time
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env, local_device_identity
from gcs_bridge.action_lifecycle import ActionLifecycle
from gcs_bridge.action_runner import FileActionPoller
from gcs_bridge.analysis_runner import (
    analysis_document_context,
    analysis_pages,
    analysis_requirement_excerpt,
    extract_analysis_modules,
    requirement_groups,
    requirement_ids,
)
from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.codex_meter import sync_codex_threads as sync_codex_meter_threads
from gcs_bridge.command_utils import command_path
from gcs_bridge.heartbeat import send_heartbeat
from gcs_bridge.local_paths import collect_project_paths as collect_local_project_paths
from gcs_bridge.local_paths import remember_project_path as remember_local_project_path
from gcs_bridge.prompt_builder import (
    apply_prompt_budget,
    build_task_run_prompt,
    dict_value,
    estimate_text_tokens,
    string_list,
)
from gcs_bridge.sanitizer import sanitize_json, sanitize_text
from gcs_bridge.task_runner import (
    drain_process_output,
    pipe_reader,
    quote_cmd_arg,
)
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

def headers() -> dict[str, str]:
    return CLIENT.headers()


def post_json(path: str, payload: dict, timeout: int = 8) -> tuple[bool, str]:
    return CLIENT.post_json(path, payload, timeout=timeout)


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


def _safe_local_target(project_path: str, relative_path: str) -> Path:
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


def execute_analysis_action(action: dict[str, Any]) -> dict[str, Any]:
    """Run `claude -p` to generate project modules/tasks and POST result to dashboard."""
    import re
    import subprocess
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
    project_name = str(payload.get("projectName") or "")
    frameworks = payload.get("frameworks") or []
    docs = payload.get("docs") or {}
    callback_path = str(payload.get("callbackPath") or "")

    brd_path = docs.get("brd") or docs.get("prd") or ""
    brd_filename = Path(brd_path).name if brd_path else "no document"
    document_context = analysis_document_context(str(brd_path))
    requirement_context = analysis_requirement_excerpt(document_context)
    page_count = len(analysis_pages(document_context))
    req_groups = requirement_groups(document_context)
    req_ids = requirement_ids(document_context)
    page_estimate = page_count if document_context else 0
    fw = ", ".join(f for f in frameworks if f != "unknown") or "unknown stack"

    # Load skill summaries from local SKILL.md files
    skill_slugs = payload.get("skillSlugs") or []
    skill_block = ""
    if skill_slugs:
        skill_lines = []
        for slug in skill_slugs[:6]:  # max 6 skills to limit tokens
            for skill_path in [
                ROOT / "skills" / "analysis" / slug / "SKILL.md",
                ROOT / "skills" / "workflow" / slug / "SKILL.md",
                ROOT / "skills" / "frameworks" / slug / "SKILL.md",
                ROOT / "skills" / "imported" / "github-sources" / slug / "SKILL.md",
            ]:
                if skill_path.exists():
                    try:
                        raw = skill_path.read_text(encoding="utf-8", errors="replace")
                        # First 600 chars after frontmatter — enough guidance, not too many tokens
                        content = re.sub(r'^---[\s\S]*?---\n', '', raw).strip()[:600]
                        skill_lines.append(f"### {slug}\n{content}")
                    except Exception:
                        pass
                    break
        if skill_lines:
            skill_block = "\n\n## Skill Guidance\n" + "\n\n".join(skill_lines)

    prompt = (
        f"You are a senior BA/Product Analyst. Generate a structured implementation plan.\n\n"
        f"## Project Context\n"
        f"- Name: {project_name}\n- Stack: {fw}\n- Document: {brd_filename}"
        f"\n\n## Page-Tagged Requirement Context\n{requirement_context}"
        f"{skill_block}\n\n"
        f"## Output Requirements\n"
        f"Generate modules from the BRD requirement groups, not from generic booking app assumptions.\n"
        f"Use these domain modules when supported by the BRD: Core Platform, Cinema Booking, Hotel Booking, Cross-domain Payment/Refund/State, Global UI/Reporting/Operations.\n"
        f"Do not create generic modules such as Listing & Inventory unless they map directly to BRD requirement IDs.\n"
        f"Each module should have 1-4 features, each feature 1-4 atomic tasks. Keep the first generation concise; the UI can expand details later.\n"
        f"Tasks must be specific and actionable (real BRD entities, screens, actions, state rules).\n"
        f"Each task must be an object with developer-ready detail: summary, details, acceptanceCriteria, steps, priority, estimate, risk, deps.\n"
        f"Each task MUST include reqIds: string[] containing the BRD requirement IDs it implements, e.g. CORE-AUTH-001 or CIN-SHOW-003.\n"
        f"When useful, mention source page numbers in details/risk using the Page N markers from the context.\n"
        f"If a task comes from a BRD section without a clear Req ID, keep reqIds empty and put the assumption in risk.\n"
        f"Apply MoSCoW: must-have tasks first. Flag high-risk: payments, real-time, auth.\n\n"
        f"Do not use shell commands or search the filesystem. Use only the context in this prompt.\n"
        f"Respond ONLY with valid JSON:\n"
        f'{{"modules":[{{"name":"...","features":[{{"name":"...","tasks":[{{"name":"...","summary":"one sentence","details":"implementation scope and context","acceptanceCriteria":["..."],"steps":["..."],"reqIds":["CORE-AUTH-001"],"priority":"must|should|could","estimate":"1h|2h|4h","risk":"optional risk note","deps":[]}}]}}]}}]}}'
    )

    action_id = str(action.get("id") or "")
    claim_token = str(action.get("claimToken") or "") or None
    post_action_progress(action_id, [
        f"Started local Claude analysis for {project_name}.",
        f"Document path: {brd_path or 'none'}",
        f"Extracted document text: {len(document_context):,} chars, ~{page_estimate} pages.",
        f"Attached page-tagged requirement excerpt: {len(requirement_context):,} chars across {page_count} pages.",
        f"Detected requirement groups: {', '.join(req_groups) if req_groups else 'none'}",
        f"Detected requirement IDs: {len(req_ids)}",
        f"Stack: {fw}",
        "Attached extracted document context to local Claude via stdin.",
    ])
    import tempfile
    max_turns = os.environ.get("GCS_CLAUDE_ANALYZE_MAX_TURNS", "8")
    analyze_timeout = int(os.environ.get("GCS_CLAUDE_ANALYZE_TIMEOUT_SEC", "900"))
    post_action_progress(action_id, [f"Local Claude timeout guard: {analyze_timeout // 60}m {analyze_timeout % 60}s."])
    claude_command = [
        "claude", "-p",
        "--input-format", "text",
        "--output-format", "json",
        "--max-turns", max_turns,
        "--allowedTools", "",
    ]
    claude_command_display = (
        'type "<attached-analysis-prompt.txt>" | '
        f'claude -p --input-format text --output-format json --max-turns {max_turns} --allowedTools ""'
    )
    process = subprocess.Popen(
        claude_command,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
        cwd=tempfile.gettempdir(),  # neutral dir — avoid loading GCS CLAUDE.md
    )
    try:
        assert process.stdin is not None
        process.stdin.write(prompt)
        process.stdin.close()
    except Exception as exc:
        process.kill()
        raise ValueError(f"Failed to attach analysis prompt to Claude stdin: {exc}") from exc

    # Stream stdout and forward chunks to dashboard so UI can show live output.
    # Use reader threads so the bridge can still notice dashboard-side cancellation while Claude is running.
    import queue
    import threading
    raw_chunks: list[str] = []
    stderr_chunks: list[str] = []
    pending_lines: list[str] = []
    flush_every = 3  # send every N lines
    output_queue: "queue.Queue[tuple[str, str | None]]" = queue.Queue()

    def _reader(name: str, stream: Any) -> None:
        try:
            for stream_line in stream:
                output_queue.put((name, stream_line))
        finally:
            output_queue.put((name, None))

    assert process.stdout is not None
    assert process.stderr is not None
    threading.Thread(target=_reader, args=("stdout", process.stdout), daemon=True).start()
    threading.Thread(target=_reader, args=("stderr", process.stderr), daemon=True).start()

    deadline = time.time() + analyze_timeout
    next_cancel_check = 0.0
    next_heartbeat = 0.0
    next_running_progress = time.time() + 60
    open_streams = {"stdout", "stderr"}
    while open_streams:
        try:
            stream_name, line = output_queue.get(timeout=0.5)
            if line is None:
                open_streams.discard(stream_name)
            elif stream_name == "stdout":
                raw_chunks.append(line)
                display = line.rstrip()
                if display:
                    pending_lines.append(display)
            else:
                stderr_chunks.append(line)
        except queue.Empty:
            pass

        if pending_lines and (len(pending_lines) >= flush_every or process.poll() is not None):
            post_action_progress(action_id, pending_lines)
            pending_lines = []

        now = time.time()
        if now >= next_heartbeat:
            next_heartbeat = now + 30
            if not refresh_action_lease(action_id, claim_token):
                process.kill()
                post_action_progress(action_id, ["Cancelled locally."])
                raise ValueError("Analysis cancelled by user")
            heartbeat(False)

        if now >= next_running_progress:
            next_running_progress = now + 60
            remaining = max(0, int(deadline - now))
            post_action_progress(action_id, [f"Claude still running locally... timeout in ~{remaining // 60}m {remaining % 60}s."])

        if now >= next_cancel_check:
            next_cancel_check = now + 2
            if is_action_cancelled(action_id):
                process.kill()
                post_action_progress(action_id, ["Cancelled locally."])
                raise ValueError("Analysis cancelled by user")

        if now > deadline:
            process.kill()
            raise ValueError(f"claude -p timed out after {analyze_timeout}s")

        if process.poll() is not None and not open_streams:
            break

    if pending_lines:
        post_action_progress(action_id, pending_lines)

    process.wait(timeout=5)
    if process.returncode != 0:
        stderr = "".join(stderr_chunks).strip()[:300]
        stdout_tail = "".join(raw_chunks).strip()[-600:]
        detail = stderr or stdout_tail
        raise ValueError(f"claude -p failed (rc={process.returncode}): {detail}")

    raw = "".join(raw_chunks).strip()
    outer: dict[str, Any] = {}
    try:
        outer = json.loads(raw)
        content = outer.get("result") or outer.get("content") or raw
    except Exception:
        content = raw

    modules = extract_analysis_modules(str(content))
    if not modules:
        raise ValueError("Empty modules in claude output")
    total_features = sum(len(module.get("features", [])) for module in modules if isinstance(module, dict))
    total_tasks = sum(
        len(feature.get("tasks", []))
        for module in modules if isinstance(module, dict)
        for feature in module.get("features", []) if isinstance(feature, dict)
    )
    module_names = [str(module.get("name") or "Untitled") for module in modules if isinstance(module, dict)]
    post_action_progress(action_id, [
        f"Claude generated {len(modules)} modules, {total_features} features, {total_tasks} tasks.",
        "Modules: " + ", ".join(module_names[:8]),
        "Posting generated backlog to dashboard...",
    ])
    transcript = {
        "provider": "claude",
        "runner": "local-claude",
        "projectName": project_name,
        "documentPath": str(brd_path or ""),
        "documentContext": document_context,
        "documentExcerpt": requirement_context,
        "detectedRequirementGroups": req_groups,
        "detectedRequirementIds": req_ids[:500],
        "frameworks": fw,
        "skillSlugs": skill_slugs,
        "command": claude_command_display,
        "prompt": prompt,
        "responseText": str(content),
        "rawOutput": raw[-20000:],
        "durationMs": outer.get("duration_ms"),
        "durationApiMs": outer.get("duration_api_ms"),
        "sessionId": outer.get("session_id"),
        "totalCostUsd": outer.get("total_cost_usd"),
        "usage": outer.get("usage"),
        "modelUsage": outer.get("modelUsage"),
        "permissionDenials": outer.get("permission_denials") or [],
        "terminalReason": outer.get("terminal_reason"),
    }

    # POST result back to dashboard
    ok, detail = post_json_data(callback_path, {
        "actionId": action_id,
        "projectName": project_name,
        "modules": modules,
        "analysisTranscript": transcript,
    }, timeout=15)
    if not ok:
        raise ValueError(f"Failed to post analysis result: {detail}")
    post_action_progress(action_id, ["Dashboard accepted generated backlog.", "Done."])

    return {
        "source": "local-claude",
        "modules": len(modules),
        "features": total_features,
        "tasks": total_tasks,
        "analysisTranscript": transcript,
        "summary": {
            "modules": [
                {
                    "name": str(module.get("name") or "Untitled"),
                    "reqIds": sorted({
                        req_id
                        for feature in module.get("features", [])
                        if isinstance(feature, dict)
                        for task in feature.get("tasks", [])
                        if isinstance(task, dict)
                        for req_id in task.get("reqIds", [])
                        if isinstance(req_id, str)
                    })[:16],
                    "features": [
                        {
                            "name": str(feature.get("name") or "Untitled"),
                            "reqIds": sorted({
                                req_id
                                for task in feature.get("tasks", [])
                                if isinstance(task, dict)
                                for req_id in task.get("reqIds", [])
                                if isinstance(req_id, str)
                            })[:12],
                            "tasks": [
                                str(task.get("name") or "Untitled task") if isinstance(task, dict) else str(task)
                                for task in feature.get("tasks", [])[:5]
                            ],
                        }
                        for feature in module.get("features", [])[:4]
                        if isinstance(feature, dict)
                    ],
                }
                for module in modules[:8]
                if isinstance(module, dict)
            ],
        },
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None]


def _fetch_task_prompt(task_id: str, phase: str, role: str) -> str:
    ok, res = post_json_data("/api/bridge/prompt-context", {"taskId": task_id, "phase": phase, "role": role}, timeout=30)
    if ok and isinstance(res, dict) and "promptText" in res:
        return str(res["promptText"])
    if isinstance(res, dict) and "error" in res:
        raise ValueError(f"Failed to fetch prompt context: {res['error']}")
    raise ValueError(f"Failed to fetch prompt context for {task_id}: dashboard unreachable or returned unexpected response.")


def _load_skill_content(slugs: list[str]) -> str:
    """Load up to 6 SKILL.md files and return a combined guidance block."""
    if not slugs:
        return ""
    skill_lines: list[str] = []
    skill_dirs = ["analysis", "workflow", "frameworks", "imported/github-sources"]
    for slug in slugs[:6]:
        for subdir in skill_dirs:
            skill_path = ROOT / "skills" / subdir / slug / "SKILL.md"
            if skill_path.exists():
                try:
                    raw = skill_path.read_text(encoding="utf-8", errors="replace")
                    content = re.sub(r'^---[\s\S]*?---\n', '', raw).strip()[:600]
                    skill_lines.append(f"### {slug}\n{content}")
                except Exception:
                    pass
                break
    if not skill_lines:
        return ""
    return "\n\n## Skill Guidance\n" + "\n\n".join(skill_lines)


def _extract_cli_result(text: str) -> dict[str, Any]:
    for raw in reversed([line.strip() for line in text.splitlines() if line.strip()]):
        if not raw.startswith("{"):
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if isinstance(data, dict) and data.get("type") == "result":
            return data
    return {}


def _extract_text_from_stream(text: str) -> str:
    """Extract assistant text content from claude stream-json JSONL output."""
    parts: list[str] = []
    for raw in [line.strip() for line in text.splitlines() if line.strip()]:
        if not raw.startswith("{"):
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        # stream-json: assistant message content blocks
        if data.get("type") == "assistant":
            message = data.get("message") if isinstance(data.get("message"), dict) else data
            for block in (message.get("content") or []):
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(str(block.get("text") or ""))
        # fallback: text event
        elif data.get("type") == "text":
            parts.append(str(data.get("text") or ""))
    return "\n".join(p for p in parts if p).strip()


def _safe_artifact_path(project_path: str, task_id: str, phase: str) -> Path:
    safe_task = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in task_id)[:160] or "task"
    filename = "review.md" if phase == "review" else "brief.md" if phase == "analysis" else "implementation.md"
    return _safe_local_target(project_path, f".gcs/tasks/{safe_task}/{filename}")


def _safe_task_file(project_path: str, task_id: str, filename: str) -> Path:
    safe_task = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in task_id)[:160] or "task"
    return _safe_local_target(project_path, f".gcs/tasks/{safe_task}/{filename}")


def _post_task_event(task_id: str, phase: str, status: str, provider: str, role: str, note: str) -> None:
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
        timeout=8,
    )


def _post_task_artifact(project: str, task_id: str, kind: str, path: str, content: str) -> None:
    post_json_data(
        "/api/bridge/artifact",
        {
            "project": project,
            "taskId": task_id,
            "kind": kind,
            "path": path,
            "content": content[:200000],
        },
        timeout=8,
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
        except Exception as e:
            print(f"[bridge] Warning: failed to create .claudeignore: {e}", flush=True)
    else:
        # Check if our marker is present, if not, append.
        try:
            content = ignore_path.read_text(encoding="utf-8", errors="replace")
            if "node_modules/" not in content:
                with ignore_path.open("a", encoding="utf-8") as f:
                    f.write("\n\n# GCS Global Additions\n" + "\n".join(patterns[1:]) + "\n")
                print(f"[bridge] Appended global ignore patterns to {ignore_path}", flush=True)
        except Exception:
            pass


def _sync_task_to_progress(project_name: str, payload: dict[str, Any]) -> None:
    """Upsert task details from bridge action payload into the hub's progress.json."""
    task_data = payload.get("task")
    if not isinstance(task_data, dict):
        return
    task_id = str(task_data.get("id") or payload.get("taskId") or "")
    if not task_id:
        return

    progress_path = ROOT / "projects" / project_name / "progress.json"
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

    # Find or create module
    module_entry = next((m for m in progress["modules"] if m.get("name") == module_name), None)
    if not module_entry:
        module_entry = {"name": module_name, "features": []}
        progress["modules"].append(module_entry)
    module_entry.setdefault("features", [])

    # Find or create feature
    feature_entry = next((f for f in module_entry["features"] if f.get("name") == feature_name), None)
    if not feature_entry:
        feature_entry = {"name": feature_name, "tasks": []}
        module_entry["features"].append(feature_entry)
    feature_entry.setdefault("tasks", [])

    # Upsert task
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


def execute_task_action(action: dict[str, Any]) -> dict[str, Any]:
    action_id = str(action.get("id") or "")
    claim_token = str(action.get("claimToken") or "") or None
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
    project_name = str(payload.get("projectName") or "local")
    project_path = str(payload.get("projectPath") or "")
    task_id = str(payload.get("taskId") or "")
    provider = str(payload.get("provider") or "claude").lower()
    role = str(payload.get("role") or ("dev-implementer" if provider == "codex" else "run-task"))
    phase = str(payload.get("phase") or "implementation")
    model = payload.get("model") if isinstance(payload.get("model"), str) else ""
    if not project_path or not task_id:
        raise ValueError("run_task requires projectPath and taskId")

    cwd = Path(project_path).expanduser()
    if not cwd.exists():
        raise ValueError(f"projectPath is not accessible on this device: {project_path}")

    # Enforce global ignore rules before starting the agent
    ensure_global_ignore(cwd)

    post_action_progress(action_id, [
        f"Starting local {provider} task run for {task_id}.",
        f"Project path: {project_path}",
        f"Role: {role}",
        "Syncing task details to hub...",
    ])
    _sync_task_to_progress(project_name, payload)
    _post_task_event(task_id, phase, "in_progress", provider, role, f"Local {provider} started {phase} for {task_id}.")

    started = time.time()
    timeout_sec = int(os.environ.get("GCS_TASK_RUN_TIMEOUT_SEC", "1800"))
    stdout = ""
    stderr = ""
    returncode = 1
    env = os.environ.copy()
    env.update({
        "GCS_PROJECT": project_name,
        "GCS_PROJECT_PATH": project_path,
        "GCS_TASK_ID": task_id,
        "GCS_PROVIDER": provider,
        "GCS_ROLE": role,
    })
    if model:
        env["GCS_MODEL"] = model

    optimizer = dict_value(payload.get("optimizer"))
    skill_routing = dict_value(payload.get("skillRouting"))
    context_plan = dict_value(payload.get("contextPlan"))
    prompt = build_task_run_prompt(payload, project_name, project_path, task_id, provider, role, phase, model, ROOT)
    prompt, budget_report = apply_prompt_budget(prompt, context_plan)
    prompt_path = _safe_task_file(project_path, task_id, "prompt.md")
    prompt_path.parent.mkdir(parents=True, exist_ok=True)
    prompt_path.write_text(prompt, encoding="utf-8")
    rel_prompt = str(prompt_path.relative_to(cwd)) if prompt_path.is_relative_to(cwd) else str(prompt_path)
    context_report = {
        "taskId": task_id,
        "project": project_name,
        "provider": provider,
        "role": role,
        "model": model or None,
        "optimizer": optimizer,
        "skillRouting": skill_routing,
        "contextPlan": context_plan,
        "previousFailure": dict_value(payload.get("previousFailure")),
        "estimatedPromptTokens": estimate_text_tokens(prompt),
        "budgetReport": budget_report,
        "promptPath": rel_prompt,
        "promptPreview": prompt[:12000] + ("\n\n... prompt preview truncated ..." if len(prompt) > 12000 else ""),
        "routingTokens": 0,
    }
    context_report_path = _safe_task_file(project_path, task_id, "context-report.json")
    context_report_path.parent.mkdir(parents=True, exist_ok=True)
    context_report_path.write_text(json.dumps(context_report, indent=2, ensure_ascii=False), encoding="utf-8")
    rel_context_report = str(context_report_path.relative_to(cwd)) if context_report_path.is_relative_to(cwd) else str(context_report_path)
    task_data = payload.get("task") if isinstance(payload.get("task"), dict) else {}
    task_steps = string_list(task_data.get("steps"))
    step_count = len(task_steps)
    selected_skills = skill_routing.get("selected") if isinstance(skill_routing.get("selected"), list) else []
    selected_skill_slugs = [str(skill.get("slug")) for skill in selected_skills if isinstance(skill, dict) and skill.get("slug")]
    step_lines = [
        f"Prompt file: {rel_prompt}",
        f"Context report: {rel_context_report}",
        f"Optimizer: {optimizer.get('mode', 'auto_aggressive')} / {optimizer.get('contextMode') or context_plan.get('mode', 'standard')} - {optimizer.get('reason', 'deterministic plan')}",
        f"Skill router: {', '.join(selected_skill_slugs) if selected_skill_slugs else 'none'}; omitted {skill_routing.get('omittedCount', 0)}; 0 LLM tokens used for routing.",
        f"Estimated prompt tokens: {context_report['estimatedPromptTokens']}",
        f"Prompt budget: {budget_report['afterTokens']}/{budget_report['budgetTokens']} tokens; trimmed={budget_report['trimmed']}.",
        f"Task steps attached: {step_count}",
    ]
    if provider == "codex":
        step_lines.append("Codex CLI mode: one `codex exec` per task; task steps are embedded in the prompt.")
    for index, step in enumerate(task_steps[:8], start=1):
        step_lines.append(f"Step {index}: {step}")
    if step_count > 8:
        step_lines.append(f"... {step_count - 8} more step(s) included in prompt.")
    post_action_progress(action_id, step_lines)

    prompt_handle = None
    if provider == "claude":
        binary = command_path("claude")
        if not binary:
            raise ValueError("claude executable not found in PATH")
        cmd = [
            binary, "-p",
            "--input-format", "text",
            "--output-format", "stream-json",
            "--verbose",
            "--dangerously-skip-permissions",
            "--allowedTools", "Bash,Glob,Grep,Read,Write,Edit,Notebook,Sticker,Agent",
        ]
        if os.environ.get("GCS_MAX_TURNS"):
            cmd.extend(["--max-turns", os.environ["GCS_MAX_TURNS"]])
        if model:
            cmd.extend(["--model", model])
        display_cmd = f"type {quote_cmd_arg(str(prompt_path))} | {' '.join(quote_cmd_arg(part) for part in cmd)}"
        post_action_progress(action_id, [f"CWD: {cwd}", f"CMD: {display_cmd}"])
        proc = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        try:
            assert proc.stdin is not None
            proc.stdin.write(prompt)
            proc.stdin.close()
        except Exception as exc:
            proc.kill()
            raise ValueError(f"Failed to attach task prompt to Claude stdin: {exc}") from exc
    elif provider == "codex":
        binary = command_path("codex")
        if not binary:
            raise ValueError("codex executable not found in PATH")
        codex_args = os.environ.get("GCS_CODEX_TASK_ARGS", "exec --skip-git-repo-check").split()
        if "exec" in codex_args and "--skip-git-repo-check" not in codex_args:
            codex_args.insert(codex_args.index("exec") + 1, "--skip-git-repo-check")
        cmd = [binary, *codex_args]
        display_cmd = f"{' '.join(quote_cmd_arg(part) for part in cmd)} < {quote_cmd_arg(str(prompt_path))}"
        post_action_progress(action_id, [f"CWD: {cwd}", f"CMD: {display_cmd}", f"Prompt file: {rel_prompt}"])
        proc = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        try:
            assert proc.stdin is not None
            proc.stdin.write(prompt)
            proc.stdin.close()
        except Exception as exc:
            proc.kill()
            raise ValueError(f"Failed to attach task prompt to Codex stdin: {exc}") from exc
    else:
        raise ValueError(f"unsupported run_task provider: {provider}")

    out_queue: "queue.Queue[tuple[str, str]]" = queue.Queue()
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    stream_threads: list[threading.Thread] = []
    if proc.stdout:
        thread = threading.Thread(target=pipe_reader, args=(proc.stdout, "stdout", out_queue), daemon=True)
        thread.start()
        stream_threads.append(thread)
    if proc.stderr:
        thread = threading.Thread(target=pipe_reader, args=(proc.stderr, "stderr", out_queue), daemon=True)
        thread.start()
        stream_threads.append(thread)

    pending_output_lines: list[str] = []
    next_output_flush = time.time() + 3
    next_progress = time.time() + 30
    deadline = time.time() + timeout_sec
    while proc.poll() is None or not out_queue.empty():
        drain_process_output(proc, action_id, task_id, stdout_lines, stderr_lines, out_queue, pending_output_lines, post_action_progress)
        if pending_output_lines and time.time() >= next_output_flush:
            post_action_progress(action_id, pending_output_lines[-40:])
            pending_output_lines.clear()
            next_output_flush = time.time() + 3
        if proc.poll() is not None:
            time.sleep(0.1)
            continue
        if is_action_cancelled(action_id):
            proc.kill()
            if prompt_handle:
                prompt_handle.close()
            post_action_progress(action_id, ["Task run cancelled from dashboard."])
            _post_task_event(task_id, "blocked", "blocked", provider, role, "Task run cancelled from dashboard.")
            return {"cancelled": True, "exitCode": -1, "log": ["Task run cancelled from dashboard."]}
        if time.time() >= deadline:
            proc.kill()
            if prompt_handle:
                prompt_handle.close()
            raise ValueError(f"{provider} task run timed out after {timeout_sec}s")
        if time.time() >= next_progress:
            remaining = max(0, int(deadline - time.time()))
            post_action_progress(action_id, [f"Local {provider} still running... timeout in ~{remaining // 60}m {remaining % 60}s."])
            if not refresh_action_lease(action_id, claim_token):
                proc.kill()
                if prompt_handle:
                    prompt_handle.close()
                post_action_progress(action_id, ["Task run cancelled from dashboard."])
                _post_task_event(task_id, "blocked", "blocked", provider, role, "Task run cancelled from dashboard.")
                return {"cancelled": True, "exitCode": -1, "log": ["Task run cancelled from dashboard."]}
            heartbeat(False)
            next_progress = time.time() + 60
        time.sleep(0.5)

    for thread in stream_threads:
        thread.join(timeout=1)
    drain_process_output(proc, action_id, task_id, stdout_lines, stderr_lines, out_queue, pending_output_lines, post_action_progress)
    if pending_output_lines:
        post_action_progress(action_id, pending_output_lines[-40:])
        pending_output_lines.clear()
    if prompt_handle:
        prompt_handle.close()
    returncode = int(proc.returncode or 0)
    duration_min = round((time.time() - started) / 60, 3)
    stdout = "\n".join(stdout_lines)
    stderr = "\n".join(stderr_lines)
    combined = "\n".join(part for part in [stdout.strip(), stderr.strip()] if part)
    cli_result = _extract_cli_result(combined)
    usage = cli_result.get("usage") if isinstance(cli_result.get("usage"), dict) else {}
    model_usage = cli_result.get("modelUsage") if isinstance(cli_result.get("modelUsage"), dict) else {}
    total_tokens = 0
    if isinstance(usage, dict):
        total_tokens += int(usage.get("input_tokens") or 0)
        total_tokens += int(usage.get("cache_creation_input_tokens") or 0)
        total_tokens += int(usage.get("cache_read_input_tokens") or 0)
        total_tokens += int(usage.get("output_tokens") or 0)
    if not total_tokens and isinstance(model_usage, dict):
        for row in model_usage.values():
            if isinstance(row, dict):
                total_tokens += int(row.get("inputTokens") or 0)
                total_tokens += int(row.get("cacheCreationInputTokens") or 0)
                total_tokens += int(row.get("cacheReadInputTokens") or 0)
                total_tokens += int(row.get("outputTokens") or 0)
    if provider == "codex" and not total_tokens:
        total_tokens = max(1, round(len(prompt) / 4)) + min(4000, max(0, round(duration_min * 180)))
    total_cost = cli_result.get("total_cost_usd") if isinstance(cli_result.get("total_cost_usd"), (int, float)) else None
    context_report["actualTokens"] = total_tokens
    context_report["durationMin"] = duration_min
    context_report["exitCode"] = returncode
    context_report_path.write_text(json.dumps(context_report, indent=2, ensure_ascii=False), encoding="utf-8")

    # For stream-json output, cli_result["result"] contains the actual text response.
    # Fall back to raw combined output (plain-text or non-JSON mode).
    output_text = cli_result.get("result") or _extract_text_from_stream(combined) or combined or "(no output)"

    artifact = _safe_artifact_path(project_path, task_id, phase)
    artifact.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join([
        f"# {task_id} {phase.title()}",
        "",
        f"- Provider: {provider}",
        f"- Role: {role}",
        f"- Model: {model or cli_result.get('model') or 'default'}",
        f"- Exit code: {returncode}",
        f"- Duration: {duration_min} min",
        f"- Tokens: {total_tokens}",
        "",
        "## Output",
        "",
        output_text,
    ])
    artifact.write_text(content, encoding="utf-8")
    kind = "review" if phase == "review" else "brief" if phase == "analysis" else "implementation"
    rel_artifact = str(artifact.relative_to(cwd)) if artifact.is_relative_to(cwd) else str(artifact)
    _post_task_artifact(project_name, task_id, kind, rel_artifact, content)

    status = "completed" if returncode == 0 else "blocked"
    db_phase = "done" if returncode == 0 else "blocked"
    _post_task_event(
        task_id,
        db_phase,
        status,
        provider,
        role,
        f"Local {provider} {phase} finished with exit code {returncode}.",
    )
    post_json_data(
        "/api/log",
        {
            "type": "session",
            "project": project_name,
            "provider": provider,
            "role": role,
            "model": model or None,
            "date": datetime.now().isoformat(),
            "tasksCompleted": [task_id] if returncode == 0 else [],
            "cwd": str(cwd),
            "durationMin": duration_min,
            "totalTokens": total_tokens,
            "totalCostUSD": float(total_cost or 0),
            "sessionNotes": (
                f"Local {provider} {phase} run for {task_id} exited with code {returncode}. "
                f"Optimizer={optimizer.get('mode', 'auto_aggressive')}/{optimizer.get('contextMode') or context_plan.get('mode', 'standard')}; "
                f"skills={', '.join(selected_skill_slugs) if selected_skill_slugs else 'none'}; routing=0 LLM tokens; "
                f"contextReport={rel_context_report}."
            ),
            "risks": [] if returncode == 0 else [f"{provider} exit code {returncode}"],
        },
        timeout=8,
    )
    log_lines = [
        f"Finished local {provider} task run with exit code {returncode}.",
        f"Artifact: {rel_artifact}",
        f"Tokens: {total_tokens}",
        f"Context report: {rel_context_report}",
    ]
    post_action_progress(action_id, log_lines)
    return {
        "resultVersion": 1,
        "exitCode": returncode,
        "artifactPath": rel_artifact,
        "durationMin": duration_min,
        "tokens": total_tokens,
        "actualTokens": total_tokens,
        "contextReportPath": rel_context_report,
        "contextReport": context_report,
        "skillFeedback": {
            "selectedSkills": selected_skill_slugs,
            "status": "success" if returncode == 0 else "failed",
            "failureReason": None if returncode == 0 else f"{provider} exit code {returncode}",
        },
        "log": log_lines,
    }


_CONVENTION_DETECTORS: list[dict[str, Any]] = [
    # Each detector: exts, pattern, label, extract_fn (optional — receives match + rel_path)
    # Java / Spring Boot
    {"exts": {".java"}, "pattern": r"^package\s+([\w.]+);",
     "label": "Java package root", "extract": lambda m, p: f"`{m.group(1)}`", "max": 1},
    {"exts": {".java"}, "pattern": r"@Entity\b",
     "label": "JPA entity", "extract": lambda m, p: f"`@Entity` — see `{p}`", "max": 1},
    {"exts": {".java"}, "pattern": r"extends\s+(Jpa|Crud|PagingAndSorting)\w*Repository",
     "label": "Repository base", "extract": lambda m, p: f"`{m.group(0).split()[1]}` — see `{p}`", "max": 1},
    {"exts": {".java"}, "pattern": r"@Service\b",
     "label": "Service layer", "extract": lambda m, p: f"`@Service` — see `{p}`", "max": 1},
    {"exts": {".java"}, "pattern": r"@Transactional\b",
     "label": "Transactions", "extract": lambda m, p: "`@Transactional` on service methods", "max": 1},
    {"exts": {".java"}, "pattern": r"@RestController\b",
     "label": "Controller", "extract": lambda m, p: f"`@RestController` — see `{p}`", "max": 1},
    {"exts": {".java"}, "pattern": r"@RequiredArgsConstructor|@AllArgsConstructor",
     "label": "DI style", "extract": lambda m, p: f"`{m.group(0)}` (Lombok constructor injection)", "max": 1},
    {"exts": {".java"}, "pattern": r"@Autowired\b",
     "label": "DI style", "extract": lambda m, p: "`@Autowired` field injection", "max": 1},
    {"exts": {".java"}, "pattern": r"@RestControllerAdvice|@ControllerAdvice",
     "label": "Exception handler", "extract": lambda m, p: f"`{m.group(0)}` — see `{p}`", "max": 1},
    # Kotlin
    {"exts": {".kt"}, "pattern": r"@Entity\b",
     "label": "Kotlin JPA entity", "extract": lambda m, p: f"`@Entity` — see `{p}`", "max": 1},
    # TypeScript / Angular
    {"exts": {".ts"}, "pattern": r"@NgModule\(",
     "label": "Angular", "extract": lambda m, p: f"`@NgModule` — see `{p}`", "max": 1},
    {"exts": {".ts"}, "pattern": r"@Component\(",
     "label": "Angular component", "extract": lambda m, p: f"`@Component` — see `{p}`", "max": 1},
    # NestJS
    {"exts": {".ts"}, "pattern": r"@Controller\(",
     "label": "NestJS controller", "extract": lambda m, p: f"`@Controller` — see `{p}`", "max": 1},
    {"exts": {".ts"}, "pattern": r"@Injectable\(",
     "label": "NestJS service", "extract": lambda m, p: f"`@Injectable` — see `{p}`", "max": 1},
    # Next.js
    {"exts": {".ts", ".tsx"}, "pattern": r'"use client"',
     "label": "Next.js", "extract": lambda m, p: 'App Router — `"use client"` for interactive components', "max": 1},
    # React
    {"exts": {".tsx", ".jsx"}, "pattern": r"export (default )?function \w+\(",
     "label": "React", "extract": lambda m, p: f"functional components — see `{p}`", "max": 1},
    # Python
    {"exts": {".py"}, "pattern": r"from fastapi import|import fastapi",
     "label": "Python framework", "extract": lambda m, p: "FastAPI", "max": 1},
    {"exts": {".py"}, "pattern": r"from django|django.conf",
     "label": "Python framework", "extract": lambda m, p: "Django", "max": 1},
    {"exts": {".py"}, "pattern": r"from flask import|import flask",
     "label": "Python framework", "extract": lambda m, p: "Flask", "max": 1},
    # Go
    {"exts": {".go"}, "pattern": r"^package main",
     "label": "Go", "extract": lambda m, p: "standard Go project", "max": 1},
    # C#
    {"exts": {".cs"}, "pattern": r"\[ApiController\]",
     "label": "ASP.NET", "extract": lambda m, p: f"`[ApiController]` — see `{p}`", "max": 1},
]


def _detect_conventions(project_path: str, file_map: dict[str, list[str]]) -> str:
    """Detect project conventions by running declarative detectors against source files."""
    cwd = Path(project_path)
    seen_labels: set[str] = set()
    conventions: list[str] = []

    all_files: list[tuple[str, str]] = [
        (rel_dir, fname)
        for rel_dir, fnames in file_map.items()
        for fname in fnames
    ]

    # Flyway / Liquibase migrations (file-name based, no grep needed)
    sql_files = [f for _, f in all_files if f.endswith(".sql")]
    if sql_files:
        versions = sorted(re.findall(r"V(\d+)__", " ".join(sql_files)))
        conventions.append(f"- DB migrations: Flyway — current version V{versions[-1] if versions else '?'}")
        seen_labels.add("DB migrations")

    for detector in _CONVENTION_DETECTORS:
        label = detector["label"]
        if label in seen_labels:
            continue
        exts: set[str] = detector["exts"]
        pattern: str = detector["pattern"]
        extract = detector["extract"]
        max_hits: int = detector.get("max", 1)

        for rel_dir, fname in all_files:
            if os.path.splitext(fname)[1] not in exts:
                continue
            fpath = cwd / rel_dir / fname
            try:
                for line in fpath.read_text(encoding="utf-8", errors="replace").splitlines():
                    m = re.search(pattern, line)
                    if m:
                        rel_path = f"{rel_dir}/{fname}"
                        try:
                            value = extract(m, rel_path)
                        except Exception:
                            value = rel_path
                        conventions.append(f"- {label}: {value}")
                        seen_labels.add(label)
                        break
            except Exception:
                pass
            if label in seen_labels:
                break

    if not conventions:
        return ""
    return "## Conventions (auto-detected)\n" + "\n".join(conventions)


def execute_generate_code_index(action: dict[str, Any]) -> dict[str, Any]:
    import datetime as _dt
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
    action_id = str(action.get("id") or "")
    project_name = str(payload.get("projectName") or "")
    project_path = str(payload.get("projectPath") or "")
    if not project_path or not project_name:
        raise ValueError("generate_code_index requires projectName and projectPath")

    cwd = Path(project_path).expanduser()
    if not cwd.exists():
        raise ValueError(f"projectPath not accessible: {project_path}")

    post_action_progress(action_id, [f"Scanning {project_path} for code-index..."])

    SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "__pycache__",
                 ".venv", "target", ".turbo", ".gcs", ".gradle", ".idea"}
    SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".rs",
                   ".java", ".kt", ".rb", ".vue", ".svelte", ".cs"}

    file_map: dict[str, list[str]] = {}
    file_count = 0
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_dir = os.path.relpath(root, project_path).replace("\\", "/")
        for fname in sorted(files):
            if os.path.splitext(fname)[1] in SOURCE_EXTS:
                file_map.setdefault(rel_dir, []).append(fname)
                file_count += 1

    post_action_progress(action_id, ["Detecting conventions..."])
    conventions_block = _detect_conventions(project_path, file_map)

    today = _dt.date.today().isoformat()
    lines = [
        f"# Code Index: {project_name} [HEADER — load on /start]",
        f"Total: {file_count} files | Last indexed: {today}",
        "---FULL INDEX BELOW---",
        "",
    ]
    if conventions_block:
        lines += [conventions_block, ""]
    for rel_dir in sorted(file_map):
        lines.append(f"## {rel_dir}/")
        for fname in file_map[rel_dir]:
            lines.append(f"- `{fname}`")
        lines.append("")
    content = "\n".join(lines)

    out_path = cwd / ".gcs" / "code-index.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(content, encoding="utf-8")

    post_action_progress(action_id, [f"Code index written: {file_count} files → .gcs/code-index.md"])
    return {"fileCount": file_count, "path": str(out_path)}


def execute_file_action(action: dict[str, Any]) -> dict[str, Any]:
    action_type = str(action.get("type") or "")
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}

    if action_type == "run_analysis":
        return execute_analysis_action(action)

    if action_type == "run_task":
        return execute_task_action(action)

    if action_type == "generate_code_index":
        return execute_generate_code_index(action)

    if action_type != "sync_project_metadata":
        raise ValueError(f"unsupported file action type: {action_type}")

    project_path = str(payload.get("projectPath") or "")
    project_name = str(payload.get("projectName") or "")
    files = payload.get("files")
    if not isinstance(files, list):
        raise ValueError("payload.files must be a list")

    written: list[str] = []
    for item in files:
        if not isinstance(item, dict):
            continue
        relative_path = str(item.get("relativePath") or "")
        content = item.get("content")
        if not relative_path or not isinstance(content, str):
            continue
        target = _safe_local_target(project_path, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        written.append(str(target))

    remember_project_path(project_name, project_path)
    return {"written": written, "count": len(written)}


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

    # Auto-reload: track own script mtime
    _self = Path(__file__).resolve()
    _self_mtime = _self.stat().st_mtime

    print("GCS bridge daemon started. Press Ctrl+C to stop.", flush=True)
    print(f"Dashboard: {DASHBOARD_URL}", flush=True)

    try:
        while True:
            now = time.time()

            # Self-reload check every 10s
            try:
                new_mtime = _self.stat().st_mtime
                if new_mtime != _self_mtime:
                    print("[auto-reload] Script changed — restarting daemon...", flush=True)
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
