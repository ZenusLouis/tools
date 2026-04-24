#!/usr/bin/env python3
"""Create a ranked list of upstream skills that are relevant to GCS roles."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "skills" / "imported" / "github-inventory.json"
OUTPUT = ROOT / "skills" / "imported" / "recommended-imports.json"

ROLE_KEYWORDS = {
    "ba-analyst": ["plan", "requirement", "docs", "research", "context", "product", "spec"],
    "dev-implementer": ["next", "react", "typescript", "prisma", "docker", "kubernetes", "cloudflare", "github", "cli", "api"],
    "research-reviewer": ["review", "security", "docs", "github", "pr", "sast", "analysis"],
    "qa-test-engineer": ["test", "playwright", "browser", "accessibility", "wcag", "qa", "e2e"],
    "design-integrator": ["figma", "design", "frontend", "accessibility", "react"],
    "knowledge-curator": ["memory", "learn", "skill", "sync", "knowledge", "agents"],
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def score_skill(skill: dict) -> tuple[int, list[str]]:
    haystack = " ".join([
        skill.get("name", ""),
        skill.get("path", ""),
        skill.get("description", ""),
    ]).lower()
    roles = []
    score = 0
    for role, keywords in ROLE_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in haystack)
        if hits:
            roles.append(role)
            score += hits * 10
    if "official" in haystack or ".curated" in haystack:
        score += 5
    if skill.get("description"):
        score += 2
    return score, roles


def main() -> int:
    inventory = load_json(INVENTORY)
    recommendations = []
    for source in inventory.get("sources", []):
        for skill in source.get("skills", []):
            score, roles = score_skill(skill)
            if score <= 0:
                continue
            recommendations.append({
                "name": skill.get("name"),
                "source": source.get("url"),
                "sourceName": source.get("name"),
                "sourcePath": skill.get("path"),
                "description": skill.get("description", ""),
                "recommendedFor": roles,
                "score": score,
            })
    recommendations.sort(key=lambda item: (-item["score"], item["name"]))
    seen = set()
    unique = []
    for item in recommendations:
        key = (item["name"], item["sourceName"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    output = {
        "updatedFrom": "skills/imported/github-inventory.json",
        "totalCandidates": len(unique),
        "recommendations": unique[:80],
    }
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}")
    print(f"recommendations={len(output['recommendations'])} candidates={output['totalCandidates']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
