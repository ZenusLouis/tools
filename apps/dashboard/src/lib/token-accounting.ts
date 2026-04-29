export type TokenMeterKind = "provider_reported" | "thread_meter" | "hook_estimate";

export type TokenCreditEstimate = {
  credits: number;
  basis: "exact_split" | "input_equivalent" | "not_applicable";
  note: string;
};

type CodexRate = {
  input: number;
  cachedInput: number;
  output: number;
};

const CODEX_RATE_CARD: Record<string, CodexRate> = {
  "gpt-5.5": { input: 125, cachedInput: 12.5, output: 750 },
  "gpt-5.4": { input: 62.5, cachedInput: 6.25, output: 375 },
  "gpt-5.4-mini": { input: 18.75, cachedInput: 1.875, output: 113 },
  "gpt-5.3-codex": { input: 43.75, cachedInput: 4.375, output: 350 },
  "gpt-5.2": { input: 43.75, cachedInput: 4.375, output: 350 },
  "gpt-image-2.0-image": { input: 200, cachedInput: 50, output: 750 },
  "gpt-image-2.0-text": { input: 125, cachedInput: 31.25, output: 250 },
};

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
} as const;

function normalizeModel(model?: string | null) {
  return (model ?? "").toLowerCase().replace(/^openai\//, "");
}

export function codexRateForModel(model?: string | null): CodexRate {
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

export function estimateProviderCredits(provider: "claude" | "codex" | "chatgpt", tokens: number, model?: string | null): TokenCreditEstimate {
  if (provider === "codex") return estimateCodexCredits(tokens, model);
  return {
    credits: 0,
    basis: "not_applicable",
    note: provider === "chatgpt"
      ? "Use OpenAI usage/cost sync for provider-reported ChatGPT/API usage."
      : "Claude usage is currently hook-estimated and does not use the Codex credit rate card.",
  };
}
