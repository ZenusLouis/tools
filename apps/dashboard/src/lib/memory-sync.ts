import "server-only";
import { db } from "@/lib/db";

function normalizeKey(...parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function textList(values: string[]) {
  return values.filter(Boolean).join("\n");
}

export async function refreshMemoryGraph(workspaceId: string) {
  const [projects, lessons, decisions, runTelemetries] = await Promise.all([
    db.project.findMany({
      where: { workspaceId },
      include: {
        modules: {
          include: {
            features: {
              include: { tasks: true },
            },
          },
        },
      },
    }),
    db.lesson.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    db.decision.findMany({
      where: { project: { workspaceId } },
      orderBy: { id: "desc" },
      take: 500,
    }),
    db.runTelemetry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  let nodes = 0;

  for (const lesson of lessons) {
    await db.memoryNode.upsert({
      where: { workspaceId_key: { workspaceId, key: normalizeKey("lesson", lesson.framework, lesson.id) } },
      create: {
        workspaceId,
        kind: "lesson",
        key: normalizeKey("lesson", lesson.framework, lesson.id),
        title: `${lesson.framework} lesson`,
        body: lesson.text,
        tags: ["lesson", lesson.framework],
        metadata: { date: lesson.date?.toISOString() ?? null },
      },
      update: {
        title: `${lesson.framework} lesson`,
        body: lesson.text,
        tags: ["lesson", lesson.framework],
        metadata: { date: lesson.date?.toISOString() ?? null },
      },
    });
    nodes++;
  }

  for (const decision of decisions) {
    await db.memoryNode.upsert({
      where: { workspaceId_key: { workspaceId, key: normalizeKey("decision", decision.projectName, decision.decisionKey) } },
      create: {
        workspaceId,
        projectName: decision.projectName,
        kind: "decision",
        key: normalizeKey("decision", decision.projectName, decision.decisionKey),
        title: decision.title,
        body: decision.body,
        tags: ["decision", decision.projectName],
        metadata: { decisionKey: decision.decisionKey },
      },
      update: {
        title: decision.title,
        body: decision.body,
        tags: ["decision", decision.projectName],
        metadata: { decisionKey: decision.decisionKey },
      },
    });
    nodes++;
  }

  for (const project of projects) {
    for (const projectModule of project.modules) {
      for (const feature of projectModule.features) {
        for (const task of feature.tasks) {
          const body = textList([
            task.summary ?? "",
            task.details ?? "",
            ...task.acceptanceCriteria.map((item) => `AC: ${item}`),
            ...task.steps.map((item) => `Step: ${item}`),
            task.risk ? `Risk: ${task.risk}` : "",
          ]);
          await db.memoryNode.upsert({
            where: { workspaceId_key: { workspaceId, key: normalizeKey("task", task.id) } },
            create: {
              workspaceId,
              projectName: project.name,
              kind: "task",
              key: normalizeKey("task", task.id),
              title: task.name,
              body: body || task.name,
              tags: ["task", project.name, projectModule.name, feature.name, task.phase ?? "", task.status],
              reqIds: task.reqIds,
              metadata: {
                taskId: task.id,
                moduleId: projectModule.id,
                moduleName: projectModule.name,
                featureId: feature.id,
                featureName: feature.name,
                status: task.status,
                phase: task.phase,
              },
            },
            update: {
              title: task.name,
              body: body || task.name,
              tags: ["task", project.name, projectModule.name, feature.name, task.phase ?? "", task.status],
              reqIds: task.reqIds,
              metadata: {
                taskId: task.id,
                moduleId: projectModule.id,
                moduleName: projectModule.name,
                featureId: feature.id,
                featureName: feature.name,
                status: task.status,
                phase: task.phase,
              },
            },
          });
          nodes++;
        }
      }
    }
  }

  for (const run of runTelemetries) {
    const phase = typeof (run.metadata as Record<string, unknown> | null)?.phase === "string"
      ? (run.metadata as Record<string, string>).phase
      : run.source;
    await db.memoryNode.upsert({
      where: { workspaceId_key: { workspaceId, key: normalizeKey("run", run.id) } },
      create: {
        workspaceId,
        projectName: run.projectName,
        kind: "run-telemetry",
        key: normalizeKey("run", run.id),
        title: `${run.provider} ${phase} ${run.status}`,
        body: [
          `Task: ${run.taskId ?? "none"}`,
          `Provider: ${run.provider}`,
          `Model: ${run.model ?? "default"}`,
          `Status: ${run.status}`,
          `Phase/source: ${phase}`,
          `Context: ${run.contextMode ?? "unknown"}`,
          `Actual tokens: ${run.actualTokens ?? "unknown"}`,
          `Cost USD: ${run.normalizedCostUsd ?? "unknown"}`,
        ].join("\n"),
        tags: ["run", run.provider, phase, run.status, run.contextMode ?? ""],
        metadata: {
          actionId: run.actionId,
          taskId: run.taskId,
          selectedSkills: run.selectedSkills,
          skillScores: run.skillScores,
        },
      },
      update: {
        title: `${run.provider} ${phase} ${run.status}`,
        body: [
          `Task: ${run.taskId ?? "none"}`,
          `Provider: ${run.provider}`,
          `Model: ${run.model ?? "default"}`,
          `Status: ${run.status}`,
          `Phase/source: ${phase}`,
          `Context: ${run.contextMode ?? "unknown"}`,
          `Actual tokens: ${run.actualTokens ?? "unknown"}`,
          `Cost USD: ${run.normalizedCostUsd ?? "unknown"}`,
        ].join("\n"),
        tags: ["run", run.provider, phase, run.status, run.contextMode ?? ""],
        metadata: {
          actionId: run.actionId,
          taskId: run.taskId,
          selectedSkills: run.selectedSkills,
          skillScores: run.skillScores,
        },
      },
    });
    nodes++;
  }

  return {
    nodes,
    lessons: lessons.length,
    decisions: decisions.length,
    projects: projects.length,
    runs: runTelemetries.length,
  };
}
