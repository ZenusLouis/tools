"""Local task process helpers for Claude/Codex bridge runs."""

from __future__ import annotations

import json
import queue
import subprocess
from typing import Any, Callable


ProgressCallback = Callable[[str, list[str]], None]


def quote_cmd_arg(value: str) -> str:
    if not value:
        return '""'
    if any(ch.isspace() for ch in value) or any(ch in value for ch in ['"', "&", "|", "(", ")"]):
        return '"' + value.replace('"', '\\"') + '"'
    return value


def format_stream_line(raw: str) -> str | None:
    """Convert stream-json stdout into a human-readable line, or None to skip."""
    if not raw.startswith("{"):
        return raw
    try:
        data = json.loads(raw)
    except Exception:
        return raw
    if not isinstance(data, dict):
        return None
    event_type = data.get("type")

    if event_type == "assistant":
        message = data.get("message") if isinstance(data.get("message"), dict) else {}
        parts: list[str] = []
        for block in (message.get("content") or []):
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                text = (block.get("text") or "").strip()
                if text:
                    parts.append(text[:300])
            elif block.get("type") == "tool_use":
                name = block.get("name") or "tool"
                inp = block.get("input") or {}
                hint = ""
                if isinstance(inp, dict):
                    hint = (
                        inp.get("command")
                        or inp.get("pattern")
                        or inp.get("file_path")
                        or inp.get("prompt")
                        or inp.get("description")
                        or ""
                    )
                    if hint:
                        hint = f": {str(hint)[:120]}"
                parts.append(f"[{name}{hint}]")
        return "\n".join(parts) if parts else None

    if event_type == "system":
        subtype = data.get("subtype")
        if subtype == "task_started":
            return f"-> Agent: {data.get('description') or 'sub-task started'}"
        if subtype == "task_progress":
            desc = data.get("description") or ""
            tokens = (data.get("usage") or {}).get("total_tokens")
            suffix = f" ({tokens:,} tokens)" if tokens else ""
            return f"  {desc}{suffix}" if desc else None
        if subtype == "task_complete":
            return f"OK Agent done: {data.get('description') or ''}"
        return None

    if event_type == "user":
        message = data.get("message") if isinstance(data.get("message"), dict) else {}
        for block in (message.get("content") or []):
            if isinstance(block, dict) and block.get("is_error"):
                err = block.get("content") or ""
                if isinstance(err, list):
                    err = " ".join(str(e.get("text", "")) if isinstance(e, dict) else str(e) for e in err)
                return f"Tool error: {str(err)[:200]}"
        return None

    if event_type == "result":
        cost = data.get("total_cost_usd")
        cost_str = f" | cost ${cost:.4f}" if isinstance(cost, (int, float)) else ""
        usage = data.get("usage") or {}
        tokens = sum(usage.get(k, 0) or 0 for k in ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"])
        return f"Done - {tokens:,} tokens{cost_str}"

    return None


def pipe_reader(pipe: Any, stream_name: str, out_queue: "queue.Queue[tuple[str, str]]") -> None:
    try:
        for line in iter(pipe.readline, ""):
            out_queue.put((stream_name, line))
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def drain_process_output(
    proc: subprocess.Popen[str],
    action_id: str,
    task_id: str,
    stdout_lines: list[str],
    stderr_lines: list[str],
    out_queue: "queue.Queue[tuple[str, str]]",
    pending_lines: list[str],
    progress_callback: ProgressCallback,
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
            rendered = f"stderr> {clean}"
            pending_lines.append(rendered)
            print(f"[task {task_id}] {rendered}", flush=True)
        else:
            stdout_lines.append(clean)
            formatted = format_stream_line(clean)
            if formatted:
                for part in formatted.splitlines():
                    part = part.strip()
                    if part:
                        pending_lines.append(part)
                        print(f"[task {task_id}] {part}", flush=True)
    if (proc.poll() is not None and pending_lines) or len(pending_lines) >= 8:
        progress_callback(action_id, pending_lines[-40:])
        pending_lines.clear()
