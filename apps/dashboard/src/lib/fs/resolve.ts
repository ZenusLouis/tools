import path from "path";

export function getClaudeRoot(): string {
  return process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";
}

export function resolvePath(...segments: string[]): string {
  return path.join(getClaudeRoot(), ...segments);
}
