import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { estimateProviderCredits, TOKEN_METER_META } from "@/lib/token-accounting";

const COST_PER_MILLION = 3.0;

export type DashboardRange = "today" | "week" | "month";

export type DashboardStats = {
  activeProjects: number;
  tasksCompleted: number;
  tokenCount: number;
  sessionCost: number;
  tokenBreakdown: Array<{
    provider: "claude" | "codex" | "chatgpt";
    tokens: number;
    sessionTokens: number;
    toolTokens: number;
    percent: number;
    meterLabel: string;
    meterKind: "provider_reported" | "thread_meter" | "hook_estimate";
    meterDescription: string;
    credits: number;
    creditBasis: string;
    creditNote: string;
  }>;
};

function getRangeStart(range: DashboardRange): Date {
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === "week") {
    return new Date(Date.now() - 7 * 86_400_000);
  }
  return new Date(Date.now() - 30 * 86_400_000);
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function analysisTranscript(result: Prisma.JsonValue | null) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const transcript = (result as Record<string, unknown>).analysisTranscript;
  if (!transcript || typeof transcript !== "object" || Array.isArray(transcript)) return null;
  return transcript as Record<string, unknown>;
}

function tokenTotalFromUsage(usage: unknown) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return 0;
  const row = usage as Record<string, unknown>;
  return (
    numberField(row.input_tokens) +
    numberField(row.cache_creation_input_tokens) +
    numberField(row.cache_read_input_tokens) +
    numberField(row.output_tokens)
  );
}

function tokenTotalFromModelUsage(modelUsage: unknown) {
  if (!modelUsage || typeof modelUsage !== "object" || Array.isArray(modelUsage)) return 0;
  return Object.values(modelUsage as Record<string, unknown>).reduce<number>((sum, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return sum;
    const row = value as Record<string, unknown>;
    return sum +
      numberField(row.inputTokens) +
      numberField(row.cacheCreationInputTokens) +
      numberField(row.cacheReadInputTokens) +
      numberField(row.outputTokens);
  }, 0);
}

export async function getDashboardStats(workspaceId?: string, range: DashboardRange = "today"): Promise<DashboardStats> {
  const since = getRangeStart(range);

  const [projectCount, sessions, toolUsage, analysisActions] = await Promise.all([
    db.project.count({ where: workspaceId ? { workspaceId } : undefined }),
    db.session.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) } }),
    db.toolUsage.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) } }),
    db.bridgeFileAction.findMany({
      where: {
        type: "run_analysis",
        status: "succeeded",
        result: { not: Prisma.JsonNull },
        updatedAt: { gte: since },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { id: true, result: true },
    }),
  ]);

  const tasksCompleted = sessions.reduce((sum, session) => sum + session.tasksCompleted.length, 0);
  const sessionTranscriptPaths = new Set(sessions.map((session) => session.transcriptPath).filter(Boolean));
  const analysisFallbackTokens = analysisActions.reduce((sum, action) => {
    if (sessionTranscriptPaths.has(`bridge-action:${action.id}`)) return sum;
    const transcript = analysisTranscript(action.result);
    if (!transcript) return sum;
    return sum + (tokenTotalFromModelUsage(transcript.modelUsage) || tokenTotalFromUsage(transcript.usage));
  }, 0);
  const providers = ["claude", "codex", "chatgpt"] as const;
  const tokenBreakdown = providers.map((provider) => {
    const providerSessions = sessions.filter((session) => session.provider === provider);
    const providerTools = toolUsage.filter((usage) => usage.provider === provider);
    const recordedSessionTokens = provider === "codex" ? 0 : providerSessions.reduce((sum, session) => sum + (session.totalTokens ?? 0), 0);
    const sessionTokens = provider === "claude" ? recordedSessionTokens + analysisFallbackTokens : recordedSessionTokens;
    const toolTokens = providerTools.reduce((sum, usage) => sum + usage.tokens, 0);
    const tokens = provider === "codex" ? toolTokens : Math.max(sessionTokens, toolTokens);
    const credits = [
      ...providerTools.map((usage) => estimateProviderCredits(provider, usage.tokens, usage.model)),
      ...(provider === "codex"
        ? providerSessions.map((session) => estimateProviderCredits(provider, session.totalTokens ?? 0, session.model))
        : []),
    ];
    const creditTotal = credits.reduce((sum, item) => sum + item.credits, 0);
    const firstCredit = credits.find((item) => item.credits > 0) ?? estimateProviderCredits(provider, 0);
    return {
      provider,
      sessionTokens,
      toolTokens,
      // Codex exposes thread-level totals in its local SQLite. The bridge
      // converts that to ToolUsage deltas; session totals are metadata only.
      // Claude can stream tool usage before Stop emits a session summary.
      // Taking the max keeps today's dashboard live without double-counting
      // when both tool rows and session summaries exist for the same work.
      tokens,
      percent: 0,
      credits: creditTotal,
      creditBasis: firstCredit.basis,
      creditNote: firstCredit.note,
      ...TOKEN_METER_META[provider],
    };
  });
  const tokenCount = tokenBreakdown.reduce((sum, item) => sum + item.tokens, 0);
  const sessionCost = tokenCount * (COST_PER_MILLION / 1_000_000);
  const breakdownWithPercent = tokenBreakdown.map((item) => ({
    ...item,
    percent: tokenCount > 0 ? Math.round((item.tokens / tokenCount) * 100) : 0,
  }));

  return {
    activeProjects: projectCount,
    tasksCompleted,
    tokenCount,
    sessionCost,
    tokenBreakdown: breakdownWithPercent,
  };
}
