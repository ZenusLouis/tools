"""Document extraction and Claude analysis parsing helpers."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


REQ_ID_RE = re.compile(r"\b(?:CORE-[A-Z]+|CIN-[A-Z]+|HOT-[A-Z]+|CROSS-[A-Z]+|UI-[A-Z]+)-\d{3}\b")
REQ_GROUP_RE = re.compile(r"\b(CORE-[A-Z]+|CIN-[A-Z]+|HOT-[A-Z]+|CROSS-[A-Z]+|UI-[A-Z]+)-\d{3}\b")


def extract_pdf_text(path: Path) -> str:
    """Extract text from a PDF. Tries pdftotext first, falls back to pypdf."""
    if shutil.which("pdftotext"):
        try:
            proc = subprocess.run(
                ["pdftotext", "-layout", str(path), "-"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=int(os.environ.get("GCS_PDFTOTEXT_TIMEOUT_SEC", "60")),
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout.strip()
        except Exception:
            pass
    try:
        import pypdf  # type: ignore

        reader = pypdf.PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p for p in pages if p.strip())
    except ImportError as exc:
        raise ValueError("pypdf is not installed. Run: pip install pypdf") from exc
    except Exception as exc:
        raise ValueError(f"PDF extraction failed: {exc}") from exc


def analysis_document_context(document_path: str) -> str:
    """Return extracted document text so local model CLIs do not spend turns searching files."""
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
            text = extract_pdf_text(path)
            if not text:
                raise ValueError(f"PDF extraction produced no text for {path}")
            max_chars = int(os.environ.get("GCS_ANALYZE_DOC_MAX_CHARS", "140000"))
            return text[:max_chars]
    except Exception as exc:
        raise ValueError(f"Document path is present but could not be read: {path} ({exc})") from exc

    raise ValueError(f"Unsupported analysis document type: {path.suffix or 'unknown'}")


def requirement_groups(text: str) -> list[str]:
    return sorted(set(REQ_GROUP_RE.findall(text)))


def requirement_ids(text: str) -> list[str]:
    return sorted(set(REQ_ID_RE.findall(text)))


def analysis_pages(text: str) -> list[tuple[int, str]]:
    pages = [page.strip() for page in text.split("\f")]
    if len(pages) <= 1:
        return [(1, text.strip())]
    return [(index + 1, page) for index, page in enumerate(pages) if page.strip()]


def analysis_requirement_excerpt(text: str, max_chars: int | None = None) -> str:
    """Compact long BRDs to page-tagged requirement-bearing lines plus nearby context."""
    limit = max_chars or int(os.environ.get("GCS_ANALYZE_REQ_CONTEXT_MAX_CHARS", "36000"))
    chunks: list[str] = []

    for page_number, page_text in analysis_pages(text):
        lines = [line.rstrip() for line in page_text.splitlines()]
        keep: set[int] = set()
        page_req_ids: list[str] = []
        for index, line in enumerate(lines):
            ids = REQ_ID_RE.findall(line)
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


def extract_analysis_modules(content: str) -> list[dict[str, Any]]:
    """Parse model output into modules, tolerating fenced JSON or a single module object."""
    decoder = json.JSONDecoder()
    candidates: list[str] = []
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", content, flags=re.IGNORECASE):
        candidates.append(match.group(1).strip())
    candidates.append(content.strip())

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

    raise ValueError(f"No valid modules JSON found in model output: {content[:300]}")
