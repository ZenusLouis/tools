#!/usr/bin/env python3
"""Fetch whitelisted GitHub skill sources into an ignored local cache.

The cache is for research and inventory only. Do not commit vendored upstream code
unless a source has been reviewed and explicitly approved.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "agents" / "sources" / "github-skill-sources.json"
CACHE = ROOT / "skills" / ".cache" / "github-sources"
INVENTORY = ROOT / "skills" / "imported" / "github-inventory.json"


def run(cmd: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    return result.stdout.strip()


def load_sources() -> list[dict]:
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    return data.get("sources", [])


def safe_name(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")


def fetch_source(source: dict) -> Path:
    name = safe_name(source["name"])
    target = CACHE / name
    CACHE.mkdir(parents=True, exist_ok=True)
    if (target / ".git").exists():
      run(["git", "pull", "--ff-only"], cwd=target)
    else:
      run(["git", "clone", "--depth", "1", source["url"], str(target)])
    return target


def find_skill_files(repo_path: Path) -> list[dict]:
    skills = []
    for skill_file in repo_path.rglob("SKILL.md"):
        rel = skill_file.relative_to(repo_path).as_posix()
        text = skill_file.read_text(encoding="utf-8", errors="replace")
        name = skill_file.parent.name
        description = ""
        match = re.search(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
        if match:
            name_match = re.search(r"^name:\s*([a-z0-9-]+)\s*$", match.group(1), re.MULTILINE)
            desc_match = re.search(r"^description:\s*(.+?)\s*$", match.group(1), re.MULTILINE)
            if name_match:
                name = name_match.group(1)
            if desc_match:
                description = desc_match.group(1).strip().strip('"')
        skills.append({"name": name, "path": rel, "description": description})
    return sorted(skills, key=lambda item: item["path"])


def build_inventory(fetch: bool, limit: int | None) -> dict:
    inventory = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "cachePath": str(CACHE.relative_to(ROOT)).replace("\\", "/"),
        "sources": [],
    }
    sources = load_sources()
    if limit is not None:
        sources = sources[:limit]
    for source in sources:
        repo_path = CACHE / safe_name(source["name"])
        status = "cached" if repo_path.exists() else "missing"
        error = None
        if fetch:
            try:
                repo_path = fetch_source(source)
                status = "fetched"
            except subprocess.CalledProcessError as exc:
                error = exc.stdout[-1000:]
                status = "error"
        skills = find_skill_files(repo_path) if repo_path.exists() else []
        inventory["sources"].append({
            "name": source["name"],
            "url": source["url"],
            "kind": source.get("kind", ""),
            "status": status,
            "error": error,
            "skillCount": len(skills),
            "skills": skills[:100],
        })
    return inventory


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["inventory", "fetch"])
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    inventory = build_inventory(fetch=args.command == "fetch", limit=args.limit)
    INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {INVENTORY.relative_to(ROOT)}")
    for source in inventory["sources"]:
        print(f"{source['name']}: {source['status']} skills={source['skillCount']}")
        if source.get("error"):
            print(source["error"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
