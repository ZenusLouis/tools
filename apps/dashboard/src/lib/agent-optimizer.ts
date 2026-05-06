export const OPTIMIZER_MODES = ["auto_aggressive", "balanced", "quality", "manual"] as const;
export const CONTEXT_MODES = ["minimal", "standard", "deep"] as const;

export type OptimizerMode = (typeof OPTIMIZER_MODES)[number];
export type ContextMode = (typeof CONTEXT_MODES)[number];
export type LocalProvider = "claude" | "codex";

export type SkillBrainRow = {
  slug: string;
  name: string;
  category: string;
  description: string;
  content: string | null;
  providerCompatibility: string[];
  roleCompatibility: string[];
  tags: string[];
  sourcePath: string | null;
};

export type TaskOptimizerInput = {
  optimizerMode?: OptimizerMode;
  requestedContextMode?: ContextMode;
  phase: "analysis" | "implementation" | "review";
  provider: LocalProvider;
  model: string | null;
  roleSlug: string | null;
  roleType: string | null;
  roleSkillSlugs: string[];
  project: {
    name: string;
    frameworks: string[];
  };
  task: {
    id: string;
    name: string;
    summary: string | null;
    details: string | null;
    acceptanceCriteria: string[];
    steps: string[];
    reqIds: string[];
    priority: string | null;
    risk: string | null;
    moduleName: string;
    featureName: string;
  };
  availableSkills: SkillBrainRow[];
  retryCount?: number;
  skillFeedback?: Record<string, { successes: number; failures: number }>;
  previousFailure?: { error: string | null; logTail: string[] } | null;
};

const STOPWORDS = new Set([
  "and", "the", "for", "with", "from", "this", "that", "into", "task", "tasks",
  "implement", "implementation", "review", "analysis", "feature", "module", "project",
  "none", "null", "true", "false", "create", "update", "delete", "read", "write",
]);

const CONTEXT_CAPS: Record<ContextMode, { skillLimit: number; maxPromptTokens: number; codeIndexChars: number }> = {
  minimal: { skillLimit: 2, maxPromptTokens: 6500, codeIndexChars: 3500 },
  standard: { skillLimit: 4, maxPromptTokens: 12000, codeIndexChars: 7000 },
  deep: { skillLimit: 8, maxPromptTokens: 22000, codeIndexChars: 12000 },
};

function tokenize(text: string) {
  return Array.from(new Set(
    (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
      .filter((token) => !STOPWORDS.has(token) && token.length <= 40),
  ));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function compactGuidance(skill: SkillBrainRow) {
  const raw = (skill.content ?? "")
    .replace(/^---[\s\S]*?---\s*/m, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("# "))
    .filter((line) => /^[-*]\s+/.test(line) || /^#{2,4}\s+/.test(line) || /must|should|avoid|verify|check|use/i.test(line))
    .slice(0, 8)
    .join("\n");
  const seed = raw || skill.description || `${skill.name} guidance.`;
  return seed.length > 700 ? `${seed.slice(0, 700).trim()}...` : seed;
}

function requirementDomains(reqIds: string[]) {
  return Array.from(new Set(reqIds.map((reqId) => reqId.split("-").slice(0, 2).join("-").toLowerCase()).filter(Boolean)));
}

function chooseContextMode(input: TaskOptimizerInput): { contextMode: ContextMode; reason: string } {
  if (input.optimizerMode === "manual") {
    return {
      contextMode: input.requestedContextMode ?? "standard",
      reason: "manual optimizer mode uses the requested context mode",
    };
  }
  if (input.optimizerMode === "quality") {
    return { contextMode: "deep", reason: "quality mode keeps more skill and code context" };
  }

  const textSize = [
    input.task.name,
    input.task.summary ?? "",
    input.task.details ?? "",
    input.task.acceptanceCriteria.join(" "),
    input.task.steps.join(" "),
  ].join(" ").length;
  const highRisk = /risk|security|payment|auth|permission|migration|deploy|production|refund|concurrency|race|critical/i.test(
    `${input.task.risk ?? ""} ${input.task.name} ${input.task.details ?? ""}`,
  );
  const retryCount = input.retryCount ?? 0;

  if (input.optimizerMode === "balanced") {
    if (highRisk || retryCount > 0 || input.task.steps.length > 8 || textSize > 2200) {
      return { contextMode: "deep", reason: "balanced mode escalated because the task is risky, large, or retrying" };
    }
    return { contextMode: "standard", reason: "balanced mode uses standard context for normal task size" };
  }

  if (input.previousFailure && retryCount > 0) {
    return { contextMode: "standard", reason: "auto aggressive escalated to include the previous failure context" };
  }
  if (highRisk || retryCount > 1) {
    return { contextMode: "deep", reason: "auto aggressive escalated for high risk or repeated failure" };
  }
  if (input.task.steps.length > 6 || textSize > 1600 || input.task.reqIds.length > 5) {
    return { contextMode: "standard", reason: "auto aggressive selected standard context for a medium task" };
  }
  return { contextMode: "minimal", reason: "auto aggressive selected minimal context for a small low-risk task" };
}

function chooseModel(input: TaskOptimizerInput, contextMode: ContextMode) {
  if (input.model) {
    return {
      model: input.model,
      source: "role",
      reason: "role default model is configured, so optimizer kept it unchanged",
    };
  }
  if (input.optimizerMode === "manual") {
    return {
      model: null,
      source: "provider-default",
      reason: "manual mode without a role model uses the provider default",
    };
  }

  const retrying = (input.retryCount ?? 0) > 0 || !!input.previousFailure;
  const highRisk = /risk|security|payment|auth|permission|migration|deploy|production|refund|concurrency|race|critical/i.test(
    `${input.task.risk ?? ""} ${input.task.name} ${input.task.details ?? ""}`,
  );

  if (input.provider === "claude") {
    if (input.optimizerMode === "quality" || contextMode === "deep" || highRisk || retrying) {
      return {
        model: "claude-sonnet-4-6",
        source: "optimizer",
        reason: "Claude Sonnet selected for quality, deep context, high risk, or retry",
      };
    }
    return {
      model: "claude-haiku-4-5-20251001",
      source: "optimizer",
      reason: "Claude Haiku selected for a small low-risk run to save tokens",
    };
  }

  if (input.optimizerMode === "quality" || contextMode === "deep" || highRisk || retrying) {
    return {
      model: "gpt-5.2-codex",
      source: "optimizer",
      reason: "Codex strongest local model selected for quality, deep context, high risk, or retry",
    };
  }
  return {
    model: "gpt-5.2-codex",
    source: "optimizer",
    reason: "Codex default optimized model selected for local implementation",
  };
}

function scoreSkill(skill: SkillBrainRow, input: TaskOptimizerInput, tokens: Set<string>, domains: string[]) {
  let score = 0;
  const reasons: string[] = [];
  const slug = normalize(skill.slug);
  const corpus = [
    skill.slug,
    skill.name,
    skill.category,
    skill.description,
    skill.tags.join(" "),
    skill.providerCompatibility.join(" "),
    skill.roleCompatibility.join(" "),
    skill.sourcePath ?? "",
    (skill.content ?? "").slice(0, 1800),
  ].join(" ").toLowerCase();

  if (input.roleSkillSlugs.includes(skill.slug)) {
    score += 35;
    reasons.push("attached to role");
  }
  if (skill.category === "trusted-upstream" || skill.tags.includes("trusted-upstream")) {
    score += 10;
    reasons.push("trusted upstream");
  }
  const priorityTag = skill.tags.find((tag) => tag.startsWith("priority:"));
  if (priorityTag) {
    const priority = Number(priorityTag.split(":")[1]);
    if (Number.isFinite(priority)) {
      score += Math.min(12, Math.max(0, Math.round(priority / 10)));
      reasons.push(`source priority ${priority}`);
    }
  }
  if (skill.providerCompatibility.map(normalize).includes(input.provider)) {
    score += 14;
    reasons.push("provider match");
  }
  const roleSignals = [input.roleSlug ?? "", input.roleType ?? "", input.phase].map(normalize).filter(Boolean);
  if (skill.roleCompatibility.map(normalize).some((item) => roleSignals.includes(item))) {
    score += 18;
    reasons.push("role/phase match");
  }
  const frameworkMatches = input.project.frameworks
    .map(normalize)
    .filter((framework) => framework && corpus.includes(framework));
  if (frameworkMatches.length) {
    score += 24 + frameworkMatches.length * 6;
    reasons.push(`framework: ${frameworkMatches.slice(0, 3).join(", ")}`);
  }
  const domainMatches = domains.filter((domain) => corpus.includes(domain) || corpus.includes(domain.split("-")[0]));
  if (domainMatches.length) {
    score += 20 + domainMatches.length * 4;
    reasons.push(`req domain: ${domainMatches.slice(0, 3).join(", ")}`);
  }
  let keywordHits = 0;
  for (const token of tokens) {
    if (token.length >= 4 && corpus.includes(token)) keywordHits++;
  }
  if (keywordHits) {
    score += Math.min(42, keywordHits * 3);
    reasons.push(`${keywordHits} keyword match${keywordHits === 1 ? "" : "es"}`);
  }
  if (slug.includes(input.phase)) {
    score += 8;
    reasons.push("phase slug");
  }
  if (/debug|review|qa|test|security/.test(slug) && (input.retryCount ?? 0) > 0) {
    score += 16;
    reasons.push("retry helper");
  }
  const feedback = input.skillFeedback?.[skill.slug];
  if (feedback?.successes) {
    score += Math.min(18, feedback.successes * 6);
    reasons.push(`${feedback.successes} previous success${feedback.successes === 1 ? "" : "es"}`);
  }
  if (feedback?.failures) {
    score -= Math.min(24, feedback.failures * 8);
    reasons.push(`${feedback.failures} previous failure${feedback.failures === 1 ? "" : "s"}`);
  }
  if (/marketplace|awesome|catalog|source/.test(skill.category.toLowerCase()) && score < 20) {
    score -= 6;
    reasons.push("catalog wrapper penalty");
  }
  return { score, reasons };
}

export function buildTaskOptimizerPlan(input: TaskOptimizerInput) {
  const optimizerMode = input.optimizerMode ?? "auto_aggressive";
  const { contextMode, reason } = chooseContextMode({ ...input, optimizerMode });
  const modelSelection = chooseModel({ ...input, optimizerMode }, contextMode);
  const caps = CONTEXT_CAPS[contextMode];
  const taskText = [
    input.project.frameworks.join(" "),
    input.task.moduleName,
    input.task.featureName,
    input.task.name,
    input.task.summary ?? "",
    input.task.details ?? "",
    input.task.acceptanceCriteria.join(" "),
    input.task.steps.join(" "),
    input.task.reqIds.join(" "),
    input.task.risk ?? "",
    input.phase,
    input.provider,
    input.roleSlug ?? "",
    input.roleType ?? "",
  ].join(" ");
  const tokens = new Set(tokenize(taskText));
  const domains = requirementDomains(input.task.reqIds);
  const ranked = input.availableSkills
    .map((skill) => {
      const scored = scoreSkill(skill, input, tokens, domains);
      return {
        slug: skill.slug,
        name: skill.name,
        category: skill.category,
        score: scored.score,
        reasons: scored.reasons,
        guidance: compactGuidance(skill),
        sourcePath: skill.sourcePath,
      };
    })
    .filter((skill) => skill.score > 0 || input.roleSkillSlugs.includes(skill.slug))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  const selected = ranked.slice(0, caps.skillLimit);
  const selectedText = selected.map((skill) => `${skill.slug}: ${skill.guidance}`).join("\n");
  const taskCoreTokens = estimateTokens(taskText);
  const estimatedPromptTokens = Math.min(
    caps.maxPromptTokens,
    taskCoreTokens + estimateTokens(selectedText) + Math.ceil(caps.codeIndexChars / 4) + 900,
  );

  return {
    optimizer: {
      mode: optimizerMode,
      provider: input.provider,
      model: modelSelection.model,
      modelSource: modelSelection.source,
      modelReason: modelSelection.reason,
      contextMode,
      reason,
      zeroTokenRouting: true,
      estimatedPromptTokens,
      promptBudgetTokens: caps.maxPromptTokens,
    },
    skillRouting: {
      selected,
      omittedCount: Math.max(0, input.availableSkills.length - selected.length),
      availableCount: input.availableSkills.length,
      candidateCount: ranked.length,
      tokenCost: "0 LLM tokens used for routing",
      scoring: {
        frameworkMatch: true,
        phaseRoleMatch: true,
        keywordMatch: true,
        requirementDomainMatch: true,
        retryFeedback: (input.retryCount ?? 0) > 0,
      },
    },
    contextPlan: {
      mode: contextMode,
      maxPromptTokens: caps.maxPromptTokens,
      codeIndexMaxChars: caps.codeIndexChars,
      includedBlocks: [
        "task_core",
        "acceptance_criteria",
        "suggested_steps",
        "requirement_ids",
        "selected_skill_guidance",
        "relevant_code_index_snippets",
        ...(input.previousFailure ? ["previous_failure_output"] : []),
      ],
      omittedBlocks: input.availableSkills.length > selected.length
        ? [`${input.availableSkills.length - selected.length} unselected skill(s) kept in brain but omitted from prompt`]
        : [],
    },
  };
}
