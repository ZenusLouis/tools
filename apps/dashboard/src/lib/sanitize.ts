const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_\-]{20,}\b/g, "sk-***"],
  [/\bsk-proj-[A-Za-z0-9_\-]{20,}\b/g, "sk-proj-***"],
  [/\bAQ\.[A-Za-z0-9_\-+/=]{20,}\b/g, "AQ.***"],
  [/\bgcsb_[A-Za-z0-9_\-]{20,}\b/g, "gcsb_***"],
  [/\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b/gi, "Bearer ***"],
  [/\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g, "jwt.***"],
  [/(AUTH_SECRET|BRIDGE_TOKEN|HOOK_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=***"],
  [/(cookie|set-cookie)\s*[:=]\s*[^"\n\r]+/gi, "$1=***"],
];

export function sanitizeText(value: string): string {
  return SECRET_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function sanitizeLogLines(lines: string[], maxLines = 200): string[] {
  return lines.map((line) => sanitizeText(String(line))).slice(-maxLines);
}

export function sanitizeJson<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return sanitizeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeJson(item, depth + 1)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/secret|token|cookie|password|authorization|apiKey|api_key/i.test(key)) {
        result[key] = typeof item === "string" ? "***" : sanitizeJson(item, depth + 1);
      } else {
        result[key] = sanitizeJson(item, depth + 1);
      }
    }
    return result as T;
  }
  return value;
}
