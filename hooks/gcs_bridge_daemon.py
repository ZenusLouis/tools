#!/usr/bin/env python3
"""Long-running local GCS bridge daemon.

Keeps the local bridge online and syncs new JSONL log lines to the dashboard.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env, local_device_identity


load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
LOG_DIR = ROOT / "logs"
STATE_PATH = ROOT / "hooks" / ".gcs_bridge_state.json"
PROJECTS_DIR = ROOT / "projects"
LOCAL_PROJECT_PATHS = ROOT / "hooks" / ".gcs_project_paths.json"


def headers() -> dict[str, str]:
    result = {"Content-Type": "application/json", "User-Agent": bridge_user_agent()}
    if BRIDGE_TOKEN:
        result["x-bridge-token"] = BRIDGE_TOKEN
    if HOOK_SECRET:
        result["x-hook-secret"] = HOOK_SECRET
    return result


def post_json(path: str, payload: dict, timeout: int = 8) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(
            f"{DASHBOARD_URL}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers(),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return 200 <= resp.status < 300, body
    except Exception as exc:
        return False, str(exc)


def post_json_data(path: str, payload: dict, timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
    ok, body = post_json(path, payload, timeout=timeout)
    if not ok:
        return False, body
    try:
        data = json.loads(body)
    except Exception:
        return False, body
    if not isinstance(data, dict):
        return False, body
    return True, data


def get_json(path: str, timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
    try:
        req = urllib.request.Request(
            f"{DASHBOARD_URL}{path}",
            headers=headers(),
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if not (200 <= resp.status < 300):
                return False, body
            data = json.loads(body)
            return (True, data) if isinstance(data, dict) else (False, body)
    except Exception as exc:
        return False, str(exc)


def post_action_progress(action_id: str, lines: list[str], timeout: int = 4) -> None:
    if not action_id or not lines:
        return
    post_json(f"/api/bridge/file-actions/{action_id}/progress", {"lines": lines}, timeout=timeout)


def is_action_cancelled(action_id: str, timeout: int = 3) -> bool:
    if not action_id:
        return False
    ok, data = get_json(f"/api/bridge/file-actions/{action_id}/status", timeout=timeout)
    if not ok or not isinstance(data, dict):
        return False
    return bool(data.get("cancelled") or data.get("status") == "cancelled")


def collect_project_paths() -> list[dict[str, str]]:
    """Read local GCS project contexts and report source folders known to this device."""
    by_name: dict[str, str] = {}
    try:
        data = json.loads(LOCAL_PROJECT_PATHS.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for project_name, project_path in data.items():
                if isinstance(project_name, str) and isinstance(project_path, str) and project_name and project_path:
                    by_name[project_name] = project_path
    except Exception:
        pass

    if not PROJECTS_DIR.exists():
        return [{"projectName": name, "path": path} for name, path in sorted(by_name.items())]

    for context_path in PROJECTS_DIR.glob("*/context.json"):
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


def remember_project_path(project_name: str, project_path: str) -> None:
    if not project_name or not project_path:
        return
    try:
        data = json.loads(LOCAL_PROJECT_PATHS.read_text(encoding="utf-8")) if LOCAL_PROJECT_PATHS.exists() else {}
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    data[project_name] = project_path
    LOCAL_PROJECT_PATHS.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = LOCAL_PROJECT_PATHS.with_suffix(f"{LOCAL_PROJECT_PATHS.suffix}.tmp")
    tmp_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(LOCAL_PROJECT_PATHS)


def heartbeat(verbose: bool) -> bool:
    if not BRIDGE_TOKEN and not HOOK_SECRET:
        print("BRIDGE_TOKEN or HOOK_SECRET is not set; bridge cannot authenticate.", flush=True)
        return False

    identity = local_device_identity()
    device_key = identity["deviceKey"]
    device_name = identity["deviceName"]
    ok, detail = post_json(
        "/api/bridge/heartbeat",
        {
            "deviceKey": device_key,
            "name": device_name,
            "claudeAvailable": shutil.which("claude") is not None,
            "codexAvailable": shutil.which("codex") is not None,
            "projectPaths": collect_project_paths(),
            "metadata": {
                "cwd": os.getcwd(),
                "runner": "hooks/gcs_bridge_daemon.py",
                "startedAt": datetime.now().isoformat(),
            },
        },
    )
    if verbose or not ok:
        print(f"[heartbeat] {'ok' if ok else 'failed'} {detail[:160]}", flush=True)
    return ok


def load_state() -> dict[str, int]:
    if not STATE_PATH.exists():
        return {}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): int(value) for key, value in data.items() if isinstance(value, int)}


def save_state(state: dict[str, int]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STATE_PATH.with_suffix(f"{STATE_PATH.suffix}.tmp")
    tmp_path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(STATE_PATH)


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


def sync_log_file(path: Path, state: dict[str, int], from_end: bool) -> int:
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
            ok, detail = post_json("/api/log", payload, timeout=5)
            if ok:
                sent += 1
            else:
                print(f"[sync] failed {path.name}: {detail[:160]}", flush=True)
                break
        state[key] = handle.tell()
    return sent


CODEX_STATE_DB = Path.home() / ".codex" / "state_5.sqlite"
CODEX_STATE_KEY = "__codex_last_updated_at_ms__"
CODEX_SYNC_EXISTING = os.environ.get("GCS_CODEX_SYNC_EXISTING", "").lower() in {"1", "true", "yes"}


def _project_from_cwd(cwd: str) -> str:
    """Extract a short project name from a Codex thread cwd path."""
    clean = cwd.lstrip("\\\\?\\").replace("\\", "/")
    return Path(clean).name or "local"


def _should_backfill_existing_codex_thread(updated_at_ms: int) -> bool:
    return CODEX_SYNC_EXISTING


def _codex_token_keys(thread_id: str, updated_at_ms: int) -> tuple[str, str]:
    """Return legacy thread key plus a daily key for date-scoped token deltas."""
    updated_at = datetime.fromtimestamp(updated_at_ms / 1000)
    day_key = updated_at.strftime("%Y-%m-%d")
    legacy_key = f"__codex_thread_tokens__:{thread_id}"
    daily_key = f"__codex_thread_tokens__:{thread_id}:{day_key}"
    return legacy_key, daily_key


def sync_codex_threads(state: dict[str, int]) -> int:
    if not CODEX_STATE_DB.exists():
        return 0
    last_ms = state.get(CODEX_STATE_KEY, 0)
    try:
        conn = sqlite3.connect(str(CODEX_STATE_DB), timeout=1, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """SELECT id, updated_at_ms, model, cwd, title, tokens_used, first_user_message
               FROM threads
               WHERE tokens_used > 0 AND updated_at_ms > ?
               ORDER BY updated_at_ms ASC""",
            (last_ms,),
        ).fetchall()
        conn.close()
    except Exception as exc:
        print(f"[codex-sync] sqlite error: {exc}", flush=True)
        return 0

    sent = 0
    max_ms = last_ms
    for row in rows:
        legacy_token_key, daily_token_key = _codex_token_keys(row["id"], row["updated_at_ms"])
        previous_tokens = state.get(daily_token_key)
        legacy_previous_tokens = state.get(legacy_token_key)
        current_tokens = int(row["tokens_used"] or 0)
        if previous_tokens is None:
            if legacy_previous_tokens is not None:
                previous_tokens = legacy_previous_tokens
                state[daily_token_key] = legacy_previous_tokens

            if not _should_backfill_existing_codex_thread(row["updated_at_ms"]):
                state[daily_token_key] = current_tokens
                state[legacy_token_key] = current_tokens
                max_ms = max(max_ms, row["updated_at_ms"])
                continue

            delta_tokens = current_tokens if previous_tokens is None else max(0, current_tokens - previous_tokens)
        else:
            delta_tokens = max(0, current_tokens - previous_tokens)
            if delta_tokens <= 0:
                state[daily_token_key] = current_tokens
                state[legacy_token_key] = current_tokens
                max_ms = max(max_ms, row["updated_at_ms"])
                continue

        project = _project_from_cwd(row["cwd"] or "")
        event_date = datetime.fromtimestamp(row["updated_at_ms"] / 1000).isoformat()
        tool_payload = {
            "type": "tool",
            "ts": event_date,
            "tool": "CodexIDE",
            "tokens": delta_tokens,
            "provider": "codex",
            "role": os.environ.get("GCS_ROLE") or "dev-implementer",
            "model": row["model"] or None,
            "deviceKey": local_device_identity()["deviceKey"],
        }
        ok, detail = post_json("/api/log", {k: v for k, v in tool_payload.items() if v is not None}, timeout=5)
        if not ok:
            print(f"[codex-sync] failed tool delta {row['id'][:8]}: {detail[:120]}", flush=True)
            break

        payload = {
            "type": "session",
            "project": project,
            "provider": "codex",
            "model": row["model"] or None,
            "date": event_date,
            "tasksCompleted": [],
            "cwd": (row["cwd"] or "").lstrip("\\\\?\\"),
            "totalTokens": delta_tokens,
            "totalCostUSD": round(delta_tokens * 3.0 / 1_000_000, 6),
            "sessionNotes": row["title"] or row["first_user_message"] or None,
            "risks": [],
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        ok, detail = post_json("/api/log", payload, timeout=5)
        if ok:
            state[daily_token_key] = current_tokens
            state[legacy_token_key] = current_tokens
            max_ms = max(max_ms, row["updated_at_ms"])
            sent += 1
        else:
            print(f"[codex-sync] failed thread {row['id'][:8]}: {detail[:120]}", flush=True)
            break

    if max_ms > last_ms:
        state[CODEX_STATE_KEY] = max_ms
    if sent:
        print(f"[codex-sync] synced {sent} Codex thread(s)", flush=True)
    return sent


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


def _analysis_document_context(document_path: str) -> str:
    """Return extracted document text so claude -p does not spend turns searching files."""
    if not document_path:
        return "No document path configured."

    path = Path(document_path).expanduser()
    if not path.exists():
        raise ValueError(f"Document path configured but not accessible on this device: {document_path}")

    suffix = path.suffix.lower()
    try:
        if suffix in {".md", ".txt", ".json", ".yaml", ".yml"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            return text[: int(os.environ.get("GCS_ANALYZE_DOC_MAX_CHARS", "140000"))]
        if suffix == ".pdf":
            if shutil.which("pdftotext") is None:
                raise ValueError("pdftotext is required to analyze PDF BRDs, but it is not available in PATH.")
            import subprocess
            proc = subprocess.run(
                ["pdftotext", "-layout", str(path), "-"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=int(os.environ.get("GCS_PDFTOTEXT_TIMEOUT_SEC", "60")),
            )
            if proc.returncode != 0:
                detail = (proc.stderr or proc.stdout or "").strip()[:500]
                raise ValueError(f"pdftotext failed for {path}: {detail}")
            text = proc.stdout.strip()
            if not text:
                raise ValueError(f"pdftotext produced no text for {path}")
            max_chars = int(os.environ.get("GCS_ANALYZE_DOC_MAX_CHARS", "140000"))
            return text[:max_chars]
    except Exception as exc:
        raise ValueError(f"Document path is present but could not be read: {path} ({exc})")

    raise ValueError(f"Unsupported analysis document type: {path.suffix or 'unknown'}")


def _requirement_groups(text: str) -> list[str]:
    import re
    groups = sorted(set(re.findall(r"\b(CORE-[A-Z]+|CIN-[A-Z]+|HOT-[A-Z]+|CROSS-[A-Z]+|UI-[A-Z]+)-\d{3}\b", text)))
    return groups


def _requirement_ids(text: str) -> list[str]:
    import re
    return sorted(set(re.findall(r"\b(?:CORE-[A-Z]+|CIN-[A-Z]+|HOT-[A-Z]+|CROSS-[A-Z]+|UI-[A-Z]+)-\d{3}\b", text)))


def _analysis_pages(text: str) -> list[tuple[int, str]]:
    pages = [page.strip() for page in text.split("\f")]
    if len(pages) <= 1:
        return [(1, text.strip())]
    return [(index + 1, page) for index, page in enumerate(pages) if page.strip()]


def _analysis_requirement_excerpt(text: str, max_chars: int | None = None) -> str:
    """Compact long BRDs to page-tagged requirement-bearing lines plus nearby context."""
    import re
    limit = max_chars or int(os.environ.get("GCS_ANALYZE_REQ_CONTEXT_MAX_CHARS", "36000"))
    req_pattern = re.compile(r"\b(?:CORE-[A-Z]+|CIN-[A-Z]+|HOT-[A-Z]+|CROSS-[A-Z]+|UI-[A-Z]+)-\d{3}\b")
    chunks: list[str] = []

    for page_number, page_text in _analysis_pages(text):
        lines = [line.rstrip() for line in page_text.splitlines()]
        keep: set[int] = set()
        page_req_ids: list[str] = []
        for index, line in enumerate(lines):
            ids = req_pattern.findall(line)
            if ids:
                page_req_ids.extend(ids)
                keep.update(range(max(0, index - 2), min(len(lines), index + 4)))
        if not keep:
            continue

        chunks.append(f"\n\n## Page {page_number} | Req IDs: {', '.join(sorted(set(page_req_ids)))}")
        last = -10
        for index in sorted(keep):
            if index != last + 1:
                chunks.append("---")
            line = lines[index].strip()
            if line:
                chunks.append(line)
            last = index

    if not chunks:
        return text[:limit]
    excerpt = "\n".join(chunks)
    return excerpt[:limit]


def _extract_analysis_modules(content: str) -> list[dict[str, Any]]:
    """Parse Claude output into modules, tolerating fenced JSON or a single module object."""
    import re

    decoder = json.JSONDecoder()
    candidates: list[str] = []
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", content, flags=re.IGNORECASE):
        candidates.append(match.group(1).strip())
    candidates.append(content.strip())

    # Also try each object start. raw_decode handles trailing text that json.loads rejects as Extra data.
    for start in [match.start() for match in re.finditer(r"\{", content)]:
        candidates.append(content[start:].strip())

    parsed_values: list[Any] = []
    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed_values.append(json.loads(candidate))
            continue
        except Exception:
            pass
        try:
            value, _ = decoder.raw_decode(candidate)
            parsed_values.append(value)
        except Exception:
            continue

    for value in parsed_values:
        if isinstance(value, dict) and isinstance(value.get("modules"), list):
            return [module for module in value["modules"] if isinstance(module, dict)]

    for value in parsed_values:
        if isinstance(value, dict) and isinstance(value.get("features"), list):
            return [value]

    for value in parsed_values:
        if isinstance(value, list):
            modules = [module for module in value if isinstance(module, dict) and isinstance(module.get("features"), list)]
            if modules:
                return modules

    raise ValueError(f"No valid modules JSON found in claude output: {content[:300]}")


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
    document_context = _analysis_document_context(str(brd_path))
    requirement_context = _analysis_requirement_excerpt(document_context)
    page_count = len(_analysis_pages(document_context))
    req_groups = _requirement_groups(document_context)
    req_ids = _requirement_ids(document_context)
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

    modules = _extract_analysis_modules(str(content))
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


def _build_task_prompt(payload: dict[str, Any]) -> str:
    task = payload.get("task") if isinstance(payload.get("task"), dict) else {}
    project_name = str(payload.get("projectName") or "local")
    phase = str(payload.get("phase") or "implementation")
    provider = str(payload.get("provider") or "claude")
    skills = _string_list(payload.get("skills"))
    acceptance = _string_list(task.get("acceptanceCriteria"))
    steps = _string_list(task.get("steps"))
    req_ids = _string_list(task.get("reqIds"))
    deps = _string_list(task.get("deps"))
    return "\n".join([
        f"You are running a GCS local task as provider={provider}, phase={phase}.",
        "Work inside the current local project folder. Preserve unrelated user changes.",
        "Implement only the scoped task. After finishing, write a concise implementation summary.",
        "",
        f"Project: {project_name}",
        f"Task ID: {task.get('id') or payload.get('taskId')}",
        f"Task: {task.get('name') or 'Untitled task'}",
        f"Module: {task.get('moduleName') or ''}",
        f"Feature: {task.get('featureName') or ''}",
        f"Priority: {task.get('priority') or ''}",
        f"Estimate: {task.get('estimate') or ''}",
        f"Requirement IDs: {', '.join(req_ids) if req_ids else 'none'}",
        f"Skills: {', '.join(skills) if skills else 'default'}",
        "",
        "Summary:",
        str(task.get("summary") or ""),
        "",
        "Details:",
        str(task.get("details") or ""),
        "",
        "Acceptance Criteria:",
        *[f"- {item}" for item in acceptance],
        "",
        "Suggested Steps:",
        *[f"{index + 1}. {item}" for index, item in enumerate(steps)],
        "",
        "Dependencies:",
        *[f"- {item}" for item in deps],
        "",
        "Risk note:",
        str(task.get("risk") or ""),
        "",
        "Required output:",
        "- Modify local source files if needed.",
        "- Include changed files and verification commands in your final answer.",
        "- Do not claim success unless you actually performed the implementation or clearly explain the blocker.",
    ])


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


def _safe_artifact_path(project_path: str, task_id: str, phase: str) -> Path:
    safe_task = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in task_id)[:160] or "task"
    filename = "review.md" if phase == "review" else "brief.md" if phase == "analysis" else "implementation.md"
    return _safe_local_target(project_path, f".gcs/tasks/{safe_task}/{filename}")


def _safe_task_file(project_path: str, task_id: str, filename: str) -> Path:
    safe_task = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in task_id)[:160] or "task"
    return _safe_local_target(project_path, f".gcs/tasks/{safe_task}/{filename}")


def _quote_cmd_arg(value: str) -> str:
    if not value:
        return '""'
    if any(ch.isspace() for ch in value) or any(ch in value for ch in ['"', "&", "|", "(", ")"]):
        return '"' + value.replace('"', '\\"') + '"'
    return value


def _drain_process_output(
    proc: subprocess.Popen[str],
    action_id: str,
    task_id: str,
    stdout_lines: list[str],
    stderr_lines: list[str],
    out_queue: "queue.Queue[tuple[str, str]]",
    pending_lines: list[str],
) -> None:
    while True:
        try:
            stream_name, line = out_queue.get_nowait()
        except queue.Empty:
            break
        clean = line.rstrip("\r\n")
        if not clean:
            continue
        if stream_name == "stderr":
            stderr_lines.append(clean)
        else:
            stdout_lines.append(clean)
        rendered = f"{stream_name}> {clean}"
        pending_lines.append(rendered)
        print(f"[task {task_id}] {rendered}", flush=True)
    if (proc.poll() is not None and pending_lines) or len(pending_lines) >= 8:
        post_action_progress(action_id, pending_lines[-40:])
        pending_lines.clear()


def _pipe_reader(pipe: Any, stream_name: str, out_queue: "queue.Queue[tuple[str, str]]") -> None:
    try:
        for line in iter(pipe.readline, ""):
            out_queue.put((stream_name, line))
    finally:
        try:
            pipe.close()
        except Exception:
            pass


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


def execute_task_action(action: dict[str, Any]) -> dict[str, Any]:
    action_id = str(action.get("id") or "")
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

    prompt = _build_task_prompt(payload)
    post_action_progress(action_id, [
        f"Starting local {provider} task run for {task_id}.",
        f"Project path: {project_path}",
        f"Role: {role}",
    ])
    _post_task_event(task_id, phase, "in_progress", provider, role, f"Local {provider} started {phase} for {task_id}.")

    started = time.time()
    timeout_sec = int(os.environ.get("GCS_TASK_RUN_TIMEOUT_SEC", "1800"))
    stdout = ""
    stderr = ""
    returncode = 1
    env = os.environ.copy()
    env.update({
        "GCS_PROJECT": project_name,
        "GCS_TASK_ID": task_id,
        "GCS_PROVIDER": provider,
        "GCS_ROLE": role,
    })
    if model:
        env["GCS_MODEL"] = model

    prompt_path = _safe_task_file(project_path, task_id, "prompt.txt")
    prompt_path.parent.mkdir(parents=True, exist_ok=True)
    prompt_path.write_text(prompt, encoding="utf-8")
    rel_prompt = str(prompt_path.relative_to(cwd)) if prompt_path.is_relative_to(cwd) else str(prompt_path)

    prompt_handle = None
    if provider == "claude":
        binary = os.environ.get("GCS_CLAUDE_BIN") or shutil.which("claude")
        if not binary:
            raise ValueError("claude executable not found in PATH")
        cmd = [binary, "-p"]
        if model:
            cmd.extend(["--model", model])
        prompt_handle = prompt_path.open("r", encoding="utf-8", errors="replace")
        display_cmd = f"cd /d {_quote_cmd_arg(str(cwd))} && type {_quote_cmd_arg(str(prompt_path))} | {' '.join(_quote_cmd_arg(part) for part in cmd)}"
        post_action_progress(action_id, [f"CMD: {display_cmd}", f"Prompt file: {rel_prompt}"])
        proc = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdin=prompt_handle, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    elif provider == "codex":
        binary = os.environ.get("GCS_CODEX_BIN") or shutil.which("codex")
        if not binary:
            raise ValueError("codex executable not found in PATH")
        cmd = [binary, *os.environ.get("GCS_CODEX_TASK_ARGS", "exec").split(), prompt]
        display_cmd = f"cd /d {_quote_cmd_arg(str(cwd))} && {' '.join(_quote_cmd_arg(part) for part in cmd[:-1])} <task-prompt>"
        post_action_progress(action_id, [f"CMD: {display_cmd}", f"Prompt file: {rel_prompt}"])
        proc = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    else:
        raise ValueError(f"unsupported run_task provider: {provider}")

    out_queue: "queue.Queue[tuple[str, str]]" = queue.Queue()
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    stream_threads: list[threading.Thread] = []
    if proc.stdout:
        thread = threading.Thread(target=_pipe_reader, args=(proc.stdout, "stdout", out_queue), daemon=True)
        thread.start()
        stream_threads.append(thread)
    if proc.stderr:
        thread = threading.Thread(target=_pipe_reader, args=(proc.stderr, "stderr", out_queue), daemon=True)
        thread.start()
        stream_threads.append(thread)

    pending_output_lines: list[str] = []
    next_output_flush = time.time() + 3
    next_progress = time.time() + 30
    deadline = time.time() + timeout_sec
    while proc.poll() is None or not out_queue.empty():
        _drain_process_output(proc, action_id, task_id, stdout_lines, stderr_lines, out_queue, pending_output_lines)
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
            heartbeat(False)
            next_progress = time.time() + 60
        time.sleep(0.5)

    for thread in stream_threads:
        thread.join(timeout=1)
    _drain_process_output(proc, action_id, task_id, stdout_lines, stderr_lines, out_queue, pending_output_lines)
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
    total_cost = cli_result.get("total_cost_usd") if isinstance(cli_result.get("total_cost_usd"), (int, float)) else round(total_tokens * 3.0 / 1_000_000, 6)

    artifact = _safe_artifact_path(project_path, task_id, phase)
    artifact.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join([
        f"# {task_id} {phase.title()}",
        "",
        f"- Provider: {provider}",
        f"- Role: {role}",
        f"- Model: {model or 'default'}",
        f"- Exit code: {returncode}",
        f"- Duration: {duration_min} min",
        "",
        "## Output",
        "",
        combined or "(no output)",
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
            "sessionNotes": f"Local {provider} {phase} run for {task_id} exited with code {returncode}.",
            "risks": [] if returncode == 0 else [f"{provider} exit code {returncode}"],
        },
        timeout=8,
    )
    log_lines = [
        f"Finished local {provider} task run with exit code {returncode}.",
        f"Artifact: {rel_artifact}",
        f"Tokens: {total_tokens}",
    ]
    post_action_progress(action_id, log_lines)
    return {"exitCode": returncode, "artifactPath": rel_artifact, "durationMin": duration_min, "tokens": total_tokens, "log": log_lines}


def execute_file_action(action: dict[str, Any]) -> dict[str, Any]:
    action_type = str(action.get("type") or "")
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}

    if action_type == "run_analysis":
        return execute_analysis_action(action)

    if action_type == "run_task":
        return execute_task_action(action)

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
    device_key = local_device_identity()["deviceKey"]
    ok, data = post_json_data("/api/bridge/file-actions/pending", {"deviceKey": device_key, "limit": 5}, timeout=8)
    if not ok:
        print(f"[file-actions] poll failed: {str(data)[:160]}", flush=True)
        return 0

    actions = data.get("actions") if isinstance(data, dict) else []
    if not isinstance(actions, list) or not actions:
        return 0

    completed = 0
    for action in actions:
        if not isinstance(action, dict) or not action.get("id"):
            continue
        action_id = str(action["id"])
        try:
            result = execute_file_action(action)
            action_status = "failed" if isinstance(result, dict) and int(result.get("exitCode") or 0) != 0 else "succeeded"
            ok, detail = post_json_data(
                "/api/bridge/file-actions/result",
                {"id": action_id, "status": action_status, "deviceKey": device_key, "result": result},
                timeout=8,
            )
            if ok:
                completed += 1
                print(f"[file-actions] completed {action_id}: {result.get('count', 0)} file(s)", flush=True)
            else:
                print(f"[file-actions] result failed {action_id}: {str(detail)[:160]}", flush=True)
        except Exception as exc:
            post_json_data(
                "/api/bridge/file-actions/result",
                {"id": action_id, "status": "failed", "deviceKey": device_key, "error": str(exc)},
                timeout=8,
            )
            print(f"[file-actions] failed {action_id}: {exc}", flush=True)
    return completed


def sync_logs(state: dict[str, int], from_end: bool) -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(LOG_DIR.glob("global-*.jsonl")):
        total += sync_log_file(path, state, from_end=from_end)
    if total:
        save_state(state)
        print(f"[sync] sent {total} log entr{'y' if total == 1 else 'ies'}", flush=True)
    else:
        save_state(state)
    return total


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
