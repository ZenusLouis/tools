export type TokenMeterKind = "provider_reported" | "thread_meter" | "hook_estimate";

export type MeterTotals = {
  providerReportedTokens: number;
  hookEstimateTokens: number;
  threadMeterTokens: number;
  estimatedCostUsd: number;
};

export type TokenCreditEstimate = {
  credits: number;
  basis: "exact_split" | "input_equivalent" | "not_applicable";
  note: string;
};

type ProviderRate = {
  input: number;
  cachedInput: number;
  output: number;
};

// All rates in USD per 1M tokens
const CODEX_RATE_CARD: Record<string, ProviderRate> = {
  "gpt-5.5": { input: 125, cachedInput: 12.5, output: 750 },
  "gpt-5.4": { input: 62.5, cachedInput: 6.25, output: 375 },
  "gpt-5.4-mini": { input: 18.75, cachedInput: 1.875, output: 113 },
  "gpt-5.3-codex": { input: 43.75, cachedInput: 4.375, output: 350 },
  "gpt-5.2": { input: 43.75, cachedInput: 4.375, output: 350 },
  "gpt-image-2.0-image": { input: 200, cachedInput: 50, output: 750 },
  "gpt-image-2.0-text": { input: 125, cachedInput: 31.25, output: 250 },
};

const CLAUDE_RATE_CARD: Record<string, ProviderRate> = {
  "claude-opus-4":     { input: 15,   cachedInput: 1.5,  output: 75  },
  "claude-sonnet-4":   { input: 3,    cachedInput: 0.3,  output: 15  },
  "claude-haiku-4":    { input: 0.8,  cachedInput: 0.08, output: 4   },
  "claude-haiku-3.5":  { input: 0.8,  cachedInput: 0.08, output: 4   },
  "claude-sonnet-3.7": { input: 3,    cachedInput: 0.3,  output: 15  },
  "claude-sonnet-3.5": { input: 3,    cachedInput: 0.3,  output: 15  },
  "claude-opus-3":     { input: 15,   cachedInput: 1.5,  output: 75  },
};

const CLAUDE_DEFAULT_RATE: ProviderRate = { input: 3, cachedInput: 0.3, output: 15 };

export const TOKEN_METER_META = {
  claude: {
    meterKind: "hook_estimate" as const,
    meterLabel: "hook estimate",
    meterDescription: "Claude is currently measured from local hook/session events, so it is an activity estimate and can undercount full provider context.",
  },
  codex: {
    meterKind: "thread_meter" as const,
    meterLabel: "thread meter",
    meterDescription: "Codex comes from local thread token deltas in the Codex SQLite state. Credits use OpenAI's Codex token-based rate card when model metadata is available.",
  },
  chatgpt: {
    meterKind: "provider_reported" as const,
    meterLabel: "provider reported",
    meterDescription: "ChatGPT/OpenAI usage comes from OpenAI usage sync when configured, so it is closest to provider-reported billing usage.",
  },
  gemini: {
    meterKind: "provider_reported" as const,
    meterLabel: "provider reported",
    meterDescription: "Gemini usage is reported directly by the gemini CLI stream-json output, including token counts and sometimes cost.",
  },
} as const;

export function emptyMeterTotals(): MeterTotals {
  return {
    providerReportedTokens: 0,
    hookEstimateTokens: 0,
    threadMeterTokens: 0,
    estimatedCostUsd: 0,
  };
}

export function addMeterUsage(totals: MeterTotals, kind: TokenMeterKind, tokens: number, costUsd = 0): MeterTotals {
  return {
    providerReportedTokens: totals.providerReportedTokens + (kind === "provider_reported" ? tokens : 0),
    hookEstimateTokens: totals.hookEstimateTokens + (kind === "hook_estimate" ? tokens : 0),
    threadMeterTokens: totals.threadMeterTokens + (kind === "thread_meter" ? tokens : 0),
    estimatedCostUsd: totals.estimatedCostUsd + costUsd,
  };
}

export function primaryMeterValue(totals: MeterTotals): { label: string; value: number; unit: string } {
  if (totals.providerReportedTokens > 0) {
    return { label: "Provider-reported tokens", value: totals.providerReportedTokens, unit: "tokens" };
  }
  if (totals.threadMeterTokens > 0) {
    return { label: "Codex thread meter", value: totals.threadMeterTokens, unit: "thread tokens" };
  }
  return { label: "Claude hook estimate", value: totals.hookEstimateTokens, unit: "tokens" };
}

function normalizeModel(model?: string | null) {
  return (model ?? "").toLowerCase().replace(/^openai\//, "");
}

export function claudeRateForModel(model?: string | null): ProviderRate {
  const normalized = normalizeModel(model);
  for (const [key, rate] of Object.entries(CLAUDE_RATE_CARD)) {
    if (normalized.includes(key)) return rate;
  }
  return CLAUDE_DEFAULT_RATE;
}

export function estimateClaudeCredits(
  tokens: number,
  model?: string | null,
  split?: { inputTokens?: number | null; cachedInputTokens?: number | null; outputTokens?: number | null },
): TokenCreditEstimate {
  const rate = claudeRateForModel(model);
  const inputTokens = split?.inputTokens ?? null;
  const cachedInputTokens = split?.cachedInputTokens ?? null;
  const outputTokens = split?.outputTokens ?? null;

  if (inputTokens != null || cachedInputTokens != null || outputTokens != null) {
    const credits =
      ((inputTokens ?? 0) / 1_000_000) * rate.input +
      ((cachedInputTokens ?? 0) / 1_000_000) * rate.cachedInput +
      ((outputTokens ?? 0) / 1_000_000) * rate.output;
    return { credits, basis: "exact_split", note: "Calculated from Claude token split using Anthropic rate card." };
  }

  return {
    credits: (tokens / 1_000_000) * rate.input,
    basis: "input_equivalent",
    note: "Claude usage is hook-estimated (activity tokens only); cost uses input rate as conservative estimate.",
  };
}

export function codexRateForModel(model?: string | null): ProviderRate {
  const normalized = normalizeModel(model);
  if (normalized.includes("gpt-5.5")) return CODEX_RATE_CARD["gpt-5.5"];
  if (normalized.includes("gpt-5.4-mini")) return CODEX_RATE_CARD["gpt-5.4-mini"];
  if (normalized.includes("gpt-5.4")) return CODEX_RATE_CARD["gpt-5.4"];
  if (normalized.includes("gpt-5.3-codex")) return CODEX_RATE_CARD["gpt-5.3-codex"];
  if (normalized.includes("gpt-5.2")) return CODEX_RATE_CARD["gpt-5.2"];
  return CODEX_RATE_CARD["gpt-5.3-codex"];
}

export function estimateCodexCredits(
  tokens: number,
  model?: string | null,
  split?: { inputTokens?: number | null; cachedInputTokens?: number | null; outputTokens?: number | null },
): TokenCreditEstimate {
  const rate = codexRateForModel(model);
  const inputTokens = split?.inputTokens ?? null;
  const cachedInputTokens = split?.cachedInputTokens ?? null;
  const outputTokens = split?.outputTokens ?? null;

  if (inputTokens != null || cachedInputTokens != null || outputTokens != null) {
    const credits =
      ((inputTokens ?? 0) / 1_000_000) * rate.input +
      ((cachedInputTokens ?? 0) / 1_000_000) * rate.cachedInput +
      ((outputTokens ?? 0) / 1_000_000) * rate.output;
    return {
      credits,
      basis: "exact_split",
      note: "Calculated from input, cached input, and output token split using OpenAI's Codex token-based rate card.",
    };
  }

  return {
    credits: (tokens / 1_000_000) * rate.input,
    basis: "input_equivalent",
    note: "Codex local SQLite exposes only total thread tokens here, so this is an input-equivalent credit estimate, not exact provider billing.",
  };
}

export function estimateProviderCredits(provider: "claude" | "codex" | "chatgpt" | "gemini", tokens: number, model?: string | null): TokenCreditEstimate {
  if (provider === "codex") return estimateCodexCredits(tokens, model);
  if (provider === "claude") return estimateClaudeCredits(tokens, model);
  if (provider === "gemini") {
    const rate = (model || "").toLowerCase().includes("pro") ? 3.5 : 0.35;
    return {
        credits: (tokens / 1_000_000) * rate,
        basis: "input_equivalent",
        note: "Gemini credits estimated from local token count using Google AI rate card (Flash/Pro blend).",
    };
  }
  return {
    credits: 0,
    basis: "not_applicable",
    note: "Use OpenAI usage/cost sync for provider-reported ChatGPT/API usage.",
  };
}
