"""Build compact task execution prompts for local bridge runs."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def read_text_if_exists(path: Path, max_chars: int = 12000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n... truncated ..."
    return text


def load_project_code_index(project_name: str, project_path: str, hub_root: Path) -> str:
    local_index = Path(project_path).expanduser() / ".gcs" / "code-index.md"
    hub_index = hub_root / "projects" / project_name / "code-index.md"
    local_text = read_text_if_exists(local_index, 50000)
    if local_text:
        return f"Source: {local_index}\n\n{local_text}"
    hub_text = read_text_if_exists(hub_index, 50000)
    if hub_text:
        return f"Source: {hub_index}\n\n{hub_text}"
    return ""


def task_keyword_set(task: dict[str, Any], selected_skills: list[dict[str, Any]]) -> set[str]:
    raw = " ".join([
        str(task.get("name") or ""),
        str(task.get("summary") or ""),
        str(task.get("details") or ""),
        str(task.get("moduleName") or ""),
        str(task.get("featureName") or ""),
        " ".join(string_list(task.get("reqIds"))),
        " ".join(str(skill.get("slug") or "") for skill in selected_skills),
        " ".join(str(skill.get("name") or "") for skill in selected_skills),
    ]).lower()
    stop = {
        "and",
        "the",
        "for",
        "with",
        "from",
        "this",
        "that",
        "task",
        "tasks",
        "implement",
        "create",
        "update",
        "delete",
        "none",
        "null",
        "true",
        "false",
    }
    return {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9-]{2,}", raw)
        if token not in stop and len(token) <= 40
    }


def filter_code_index(code_index: str, task: dict[str, Any], selected_skills: list[dict[str, Any]], max_chars: int) -> str:
    if not code_index:
        return "No code-index.md found for this project yet. If structure is unclear, inspect the repository before editing."
    keywords = task_keyword_set(task, selected_skills)
    if not keywords:
        return code_index[:max_chars]
    lines = code_index.splitlines()
    chosen: list[str] = []
    chosen_indexes: set[int] = set()
    for index, line in enumerate(lines):
        lower = line.lower()
        if any(keyword in lower for keyword in keywords):
            for nearby in range(max(0, index - 2), min(len(lines), index + 3)):
                if nearby not in chosen_indexes:
                    chosen_indexes.add(nearby)
                    chosen.append(lines[nearby])
        if sum(len(item) + 1 for item in chosen) >= max_chars:
            break
    if not chosen:
        return code_index[:max_chars]
    snippet = "\n".join(chosen)
    if len(snippet) > max_chars:
        snippet = snippet[:max_chars] + "\n\n... relevant code-index snippets truncated ..."
    return snippet


def format_skill_guidance(skill_routing: dict[str, Any]) -> str:
    selected = skill_routing.get("selected")
    if not isinstance(selected, list) or not selected:
        return "- No skill guidance selected. Routing still used 0 LLM tokens."
    lines: list[str] = []
    for skill in selected:
        if not isinstance(skill, dict):
            continue
        reasons = skill.get("reasons") if isinstance(skill.get("reasons"), list) else []
        reason_text = ", ".join(str(item) for item in reasons[:4]) or "deterministic score"
        guidance = str(skill.get("guidance") or "").strip()
        lines.extend([
            f"### {skill.get('slug') or skill.get('name') or 'skill'}",
            f"- Score: {skill.get('score', 0)}",
            f"- Why selected: {reason_text}",
            guidance or "- Use the skill category and task scope as compact guidance.",
            "",
        ])
    return "\n".join(lines).strip()


def format_previous_failure(previous_failure: dict[str, Any]) -> str:
    if not previous_failure:
        return "No previous failed run for this task."
    lines = [
        f"- Updated at: {previous_failure.get('updatedAt') or 'unknown'}",
        f"- Exit code: {previous_failure.get('exitCode') if previous_failure.get('exitCode') is not None else 'unknown'}",
        f"- Artifact: {previous_failure.get('artifactPath') or 'none'}",
        f"- Error: {previous_failure.get('error') or 'none'}",
    ]
    log_tail = previous_failure.get("logTail")
    if isinstance(log_tail, list) and log_tail:
        lines.append("")
        lines.append("### Previous Log Tail")
        lines.extend(str(item) for item in log_tail[-40:])
    return "\n".join(lines)


def estimate_text_tokens(text: str) -> int:
    return max(1, round(len(text) / 4))


def apply_prompt_budget(prompt: str, context_plan: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    budget = int(context_plan.get("maxPromptTokens") or 12000)
    report: dict[str, Any] = {
        "budgetTokens": budget,
        "beforeTokens": estimate_text_tokens(prompt),
        "afterTokens": estimate_text_tokens(prompt),
        "trimmed": False,
        "trimmedBlocks": [],
    }
    if report["beforeTokens"] <= budget:
        return prompt, report

    target_chars = max(2000, budget * 4)
    markers = [
        ("## Project Code Index", "## Risk Notes", "project_code_index"),
        ("## Selected Skill Guidance", "## Task", "selected_skill_guidance"),
    ]
    next_prompt = prompt
    for start_marker, end_marker, block_name in markers:
        if len(next_prompt) <= target_chars:
            break
        start = next_prompt.find(start_marker)
        end = next_prompt.find(end_marker, start + len(start_marker)) if start >= 0 else -1
        if start < 0 or end < 0:
            continue
        block = next_prompt[start:end]
        keep_chars = 1800 if block_name == "project_code_index" else 1400
        if len(block) <= keep_chars:
            continue
        trimmed_block = block[:keep_chars].rstrip() + f"\n\n... {block_name} trimmed by prompt budget guard ...\n\n"
        next_prompt = next_prompt[:start] + trimmed_block + next_prompt[end:]
        report["trimmedBlocks"].append(block_name)

    if len(next_prompt) > target_chars:
        hard_keep = max(2000, target_chars - 600)
        next_prompt = next_prompt[:hard_keep].rstrip() + "\n\n... prompt hard-trimmed by budget guard; task core was prioritized ...\n"
        report["trimmedBlocks"].append("hard_tail")

    report["afterTokens"] = estimate_text_tokens(next_prompt)
    report["trimmed"] = True
    return next_prompt, report


def build_task_run_prompt(
    payload: dict[str, Any],
    project_name: str,
    project_path: str,
    task_id: str,
    provider: str,
    role: str,
    phase: str,
    model: str,
    hub_root: Path,
) -> str:
    task = payload.get("task") if isinstance(payload.get("task"), dict) else {}
    req_ids = string_list(task.get("reqIds"))
    acceptance = string_list(task.get("acceptanceCriteria"))
    steps = string_list(task.get("steps"))
    deps = string_list(task.get("deps"))
    optimizer = dict_value(payload.get("optimizer"))
    skill_routing = dict_value(payload.get("skillRouting"))
    context_plan = dict_value(payload.get("contextPlan"))
    previous_failure = dict_value(payload.get("previousFailure"))
    selected_skills = skill_routing.get("selected") if isinstance(skill_routing.get("selected"), list) else []
    selected_skill_dicts = [item for item in selected_skills if isinstance(item, dict)]
    code_index_max = int(context_plan.get("codeIndexMaxChars") or 7000)
    code_index = filter_code_index(load_project_code_index(project_name, project_path, hub_root), task, selected_skill_dicts, code_index_max)

    phase_instruction = {
        "analysis": "Prepare a concise implementation brief. Do not modify source files unless required to create planning artifacts.",
        "review": "Review the implementation against the task scope and acceptance criteria. Prefer findings, risks, and verification gaps.",
        "implementation": "Implement the scoped task in the local project. Modify files as needed and verify the change.",
    }.get(phase, "Implement the scoped task in the local project.")

    step_block = "\n".join(f"{index + 1}. {step}" for index, step in enumerate(steps)) or "- No explicit steps were provided; derive a safe minimal plan from the task details."
    acceptance_block = "\n".join(f"- {item}" for item in acceptance) or "- No explicit acceptance criteria were provided."
    deps_block = "\n".join(f"- {item}" for item in deps) or "- None"

    return "\n".join([
        f"You are running as {provider} local agent for GCS.",
        "",
        "## Execution Mode",
        phase_instruction,
        "Follow the Suggested Steps in order. Announce each step before working on it, then summarize the result of that step.",
        "Preserve unrelated user changes. Do not broaden scope beyond this task.",
        "",
        "## Project",
        f"- Name: {project_name}",
        f"- Path: {project_path}",
        "",
        "## Agent",
        f"- Provider: {provider}",
        f"- Role: {role}",
        f"- Model: {model or 'provider default'}",
        f"- Optimizer: {optimizer.get('mode') or 'auto_aggressive'} / {optimizer.get('contextMode') or context_plan.get('mode') or 'standard'}",
        f"- Routing token cost: {skill_routing.get('tokenCost') or '0 LLM tokens used for routing'}",
        f"- Estimated prompt tokens: {optimizer.get('estimatedPromptTokens') or 'unknown'}",
        f"- Selected skills: {', '.join(str(skill.get('slug')) for skill in selected_skill_dicts if skill.get('slug')) or 'none'}",
        f"- Omitted skills: {skill_routing.get('omittedCount') if 'omittedCount' in skill_routing else 'unknown'}",
        "",
        "## Optimizer Reason",
        str(optimizer.get("reason") or "Deterministic routing selected the compact context plan before the model was called."),
        "",
        "## Selected Skill Guidance",
        format_skill_guidance(skill_routing),
        "",
        "## Task",
        f"- ID: {task_id}",
        f"- Name: {task.get('name') or ''}",
        f"- Module: {task.get('moduleName') or ''}",
        f"- Feature: {task.get('featureName') or ''}",
        f"- Requirement IDs: {', '.join(req_ids) if req_ids else 'none'}",
        f"- Priority: {task.get('priority') or 'unspecified'}",
        f"- Estimate: {task.get('estimate') or 'unspecified'}",
        "",
        "## Summary",
        str(task.get("summary") or ""),
        "",
        "## Details",
        str(task.get("details") or ""),
        "",
        "## Acceptance Criteria",
        acceptance_block,
        "",
        "## Suggested Steps",
        step_block,
        "",
        "## Dependencies",
        deps_block,
        "",
        "## Previous Failure Context",
        format_previous_failure(previous_failure),
        "",
        "## Project Code Index",
        code_index or "No code-index.md found for this project yet. If structure is unclear, inspect the repository before editing.",
        "",
        "## Risk Notes",
        str(task.get("risk") or "None"),
        "",
        "## Required Final Response",
        "- State what changed.",
        "- List changed files.",
        "- List verification commands and results.",
        "- If blocked, explain the blocker clearly and do not claim completion.",
    ])
