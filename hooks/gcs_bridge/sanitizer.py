"""Sanitize local bridge logs before sending them to the dashboard."""

from __future__ import annotations

import re
from typing import Any


SECRET_PATTERNS = [
    (re.compile(r"\bsk-proj-[A-Za-z0-9_\-]{20,}\b"), "sk-proj-***"),
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b"), "sk-***"),
    (re.compile(r"\bAQ\.[A-Za-z0-9_\-+/=]{20,}\b"), "AQ.***"),
    (re.compile(r"\bgcsb_[A-Za-z0-9_\-]{20,}\b"), "gcsb_***"),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b", re.I), "Bearer ***"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b"), "jwt.***"),
    (
        re.compile(
            r"(AUTH_SECRET|BRIDGE_TOKEN|HOOK_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*[\"']?[^\"',\s}]+",
            re.I,
        ),
        r"\1=***",
    ),
]


def sanitize_text(value: str) -> str:
    text = str(value)
    for pattern, replacement in SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def sanitize_json(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return value
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, list):
        return [sanitize_json(item, depth + 1) for item in value]
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            if re.search(r"secret|token|cookie|password|authorization|apiKey|api_key", str(key), re.I):
                result[key] = "***" if isinstance(item, str) else sanitize_json(item, depth + 1)
            else:
                result[key] = sanitize_json(item, depth + 1)
        return result
    return value

