#!/usr/bin/env python3
"""Validate and report the local GCS agent skill catalog."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKETPLACE = ROOT / "skills" / "imported" / "marketplace.json"
SOURCES = ROOT / "agents" / "sources" / "github-skill-sources.json"
WRAPPERS = ROOT / "skills" / "imported" / "github-sources"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def skill_name_from_file(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return None
    name_match = re.search(r"^name:\s*([a-z0-9-]+)\s*$", match.group(1), re.MULTILINE)
    return name_match.group(1) if name_match else None


def wrapper_files() -> list[Path]:
    if not WRAPPERS.exists():
        return []
    return sorted(WRAPPERS.glob("*/SKILL.md"))


def check() -> int:
    errors: list[str] = []
    marketplace = load_json(MARKETPLACE)
    sources = load_json(SOURCES)

    market_names = {item["name"] for item in marketplace.get("skills", [])}
    source_urls = {item["url"] for item in sources.get("sources", [])}

    for skill in marketplace.get("skills", []):
        if not re.fullmatch(r"[a-z0-9-]+", skill["name"]):
            errors.append(f"Invalid marketplace skill name: {skill['name']}")
        if "source" in skill and skill["source"].startswith("https://github.com/"):
            owner_repo = "/".join(skill["source"].split("/")[:5])
            if owner_repo not in source_urls and skill["source"] not in source_urls:
                errors.append(f"Marketplace source is not listed in agents/sources: {skill['name']} -> {skill['source']}")

    for wrapper in wrapper_files():
        name = skill_name_from_file(wrapper)
        if not name:
            errors.append(f"Missing SKILL.md frontmatter name: {wrapper.relative_to(ROOT)}")
            continue
        if name not in market_names:
            errors.append(f"Wrapper missing from marketplace.json: {name}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("agent skill catalog ok")
    print(f"sources={len(sources.get('sources', []))} marketplace={len(market_names)} wrappers={len(wrapper_files())}")
    return 0


def report() -> int:
    marketplace = load_json(MARKETPLACE)
    sources = load_json(SOURCES)
    wrappers = {skill_name_from_file(path): path for path in wrapper_files()}

    print("# Agent Skill Catalog Report")
    print()
    print(f"- Sources: {len(sources.get('sources', []))}")
    print(f"- Marketplace skills: {len(marketplace.get('skills', []))}")
    print(f"- Local wrappers: {len(wrappers)}")
    print()
    print("## Wrapped Skills")
    for skill in marketplace.get("skills", []):
        name = skill["name"]
        wrapped = "yes" if name in wrappers else "no"
        tags = ", ".join(skill.get("tags", []))
        print(f"- {name}: wrapped={wrapped}; tags={tags}; source={skill.get('source', '')}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["check", "report"])
    args = parser.parse_args()
    return check() if args.command == "check" else report()


if __name__ == "__main__":
    raise SystemExit(main())
