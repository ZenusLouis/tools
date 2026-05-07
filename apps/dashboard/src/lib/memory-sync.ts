import "server-only";
import type { Prisma } from "@prisma/client";
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

function reqDomain(reqId: string) {
  return reqId.split("-").slice(0, 2).join("-").toLowerCase() || "requirement";
}

async function linkMemory(params: {
  workspaceId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  weight?: number;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.memoryEdge.upsert({
    where: {
      workspaceId_fromNodeId_toNodeId_relation: {
        workspaceId: params.workspaceId,
        fromNodeId: params.fromNodeId,
        toNodeId: params.toNodeId,
        relation: params.relation,
      },
    },
    create: {
      workspaceId: params.workspaceId,
      fromNodeId: params.fromNodeId,
      toNodeId: params.toNodeId,
      relation: params.relation,
      weight: params.weight ?? 1,
      metadata: params.metadata ?? ({} as Prisma.InputJsonValue),
    },
    update: {
      weight: params.weight ?? 1,
      metadata: params.metadata ?? ({} as Prisma.InputJsonValue),
    },
  });
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
  let edges = 0;
  const taskNodeByTaskId = new Map<string, string>();
  const projectNodeByName = new Map<string, string>();
  const requirementNodeByReqId = new Map<string, string>();
  const skillNodeBySlug = new Map<string, string>();

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
    const node = await db.memoryNode.upsert({
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
    if (projectNodeByName.has(decision.projectName)) {
      await linkMemory({
        workspaceId,
        fromNodeId: node.id,
        toNodeId: projectNodeByName.get(decision.projectName)!,
        relation: "belongs_to_project",
        weight: 0.8,
      });
      edges++;
    }
    nodes++;
  }

  for (const project of projects) {
    const projectNode = await db.memoryNode.upsert({
      where: { workspaceId_key: { workspaceId, key: normalizeKey("project", project.name) } },
      create: {
        workspaceId,
        projectName: project.name,
        kind: "project",
        key: normalizeKey("project", project.name),
        title: project.name,
        body: [
          project.path ? `Path: ${project.path}` : "",
          project.frameworks.length ? `Frameworks: ${project.frameworks.join(", ")}` : "",
        ].filter(Boolean).join("\n") || project.name,
        tags: ["project", project.name, ...project.frameworks],
        metadata: { path: project.path, activeTask: project.activeTask },
      },
      update: {
        body: [
          project.path ? `Path: ${project.path}` : "",
          project.frameworks.length ? `Frameworks: ${project.frameworks.join(", ")}` : "",
        ].filter(Boolean).join("\n") || project.name,
        tags: ["project", project.name, ...project.frameworks],
        metadata: { path: project.path, activeTask: project.activeTask },
      },
    });
    projectNodeByName.set(project.name, projectNode.id);
    nodes++;

    for (const projectModule of project.modules) {
      const moduleNode = await db.memoryNode.upsert({
        where: { workspaceId_key: { workspaceId, key: normalizeKey("module", project.name, projectModule.id) } },
        create: {
          workspaceId,
          projectName: project.name,
          kind: "module",
          key: normalizeKey("module", project.name, projectModule.id),
          title: projectModule.name,
          body: projectModule.name,
          tags: ["module", project.name, projectModule.name],
          metadata: { moduleId: projectModule.id, order: projectModule.order },
        },
        update: {
          title: projectModule.name,
          body: projectModule.name,
          tags: ["module", project.name, projectModule.name],
          metadata: { moduleId: projectModule.id, order: projectModule.order },
        },
      });
      nodes++;
      await linkMemory({ workspaceId, fromNodeId: moduleNode.id, toNodeId: projectNode.id, relation: "belongs_to_project", weight: 1 });
      edges++;

      for (const feature of projectModule.features) {
        const featureNode = await db.memoryNode.upsert({
          where: { workspaceId_key: { workspaceId, key: normalizeKey("feature", project.name, feature.id) } },
          create: {
            workspaceId,
            projectName: project.name,
            kind: "feature",
            key: normalizeKey("feature", project.name, feature.id),
            title: feature.name,
            body: feature.name,
            tags: ["feature", project.name, projectModule.name, feature.name],
            metadata: { featureId: feature.id, moduleId: projectModule.id, order: feature.order },
          },
          update: {
            title: feature.name,
            body: feature.name,
            tags: ["feature", project.name, projectModule.name, feature.name],
            metadata: { featureId: feature.id, moduleId: projectModule.id, order: feature.order },
          },
        });
        nodes++;
        await linkMemory({ workspaceId, fromNodeId: featureNode.id, toNodeId: moduleNode.id, relation: "belongs_to_module", weight: 1 });
        edges++;

        for (const task of feature.tasks) {
          const body = textList([
            task.summary ?? "",
            task.details ?? "",
            ...task.acceptanceCriteria.map((item) => `AC: ${item}`),
            ...task.steps.map((item) => `Step: ${item}`),
            task.risk ? `Risk: ${task.risk}` : "",
          ]);
          const taskNode = await db.memoryNode.upsert({
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
          taskNodeByTaskId.set(task.id, taskNode.id);
          nodes++;
          await linkMemory({ workspaceId, fromNodeId: taskNode.id, toNodeId: featureNode.id, relation: "belongs_to_feature", weight: 1 });
          edges++;
          for (const reqId of task.reqIds) {
            const reqNode = await db.memoryNode.upsert({
              where: { workspaceId_key: { workspaceId, key: normalizeKey("requirement", reqId) } },
              create: {
                workspaceId,
                projectName: project.name,
                kind: "requirement",
                key: normalizeKey("requirement", reqId),
                title: reqId,
                body: `Requirement ${reqId} is referenced by generated backlog tasks.`,
                tags: ["requirement", reqDomain(reqId), project.name],
                reqIds: [reqId],
                metadata: { domain: reqDomain(reqId) },
              },
              update: {
                tags: ["requirement", reqDomain(reqId), project.name],
                reqIds: [reqId],
                metadata: { domain: reqDomain(reqId) },
              },
            });
            requirementNodeByReqId.set(reqId, reqNode.id);
            await linkMemory({ workspaceId, fromNodeId: taskNode.id, toNodeId: reqNode.id, relation: "implements_requirement", weight: 1.2 });
            edges++;
          }
        }
      }
    }
  }

  for (const run of runTelemetries) {
    const phase = typeof (run.metadata as Record<string, unknown> | null)?.phase === "string"
      ? (run.metadata as Record<string, string>).phase
      : run.source;
    const runNode = await db.memoryNode.upsert({
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
    if (run.taskId && taskNodeByTaskId.has(run.taskId)) {
      await linkMemory({ workspaceId, fromNodeId: runNode.id, toNodeId: taskNodeByTaskId.get(run.taskId)!, relation: "run_of_task", weight: 0.9 });
      edges++;
    }
    for (const slug of run.selectedSkills) {
      let skillNodeId = skillNodeBySlug.get(slug);
      if (!skillNodeId) {
        const skillNode = await db.memoryNode.upsert({
          where: { workspaceId_key: { workspaceId, key: normalizeKey("skill", slug) } },
          create: {
            workspaceId,
            kind: "skill",
            key: normalizeKey("skill", slug),
            title: slug,
            body: `Skill ${slug} was selected by the zero-token router for task execution.`,
            tags: ["skill", slug],
            metadata: { slug },
          },
          update: {
            title: slug,
            body: `Skill ${slug} was selected by the zero-token router for task execution.`,
            tags: ["skill", slug],
            metadata: { slug },
          },
        });
        skillNodeId = skillNode.id;
        skillNodeBySlug.set(slug, skillNodeId);
        nodes++;
      }
      await linkMemory({ workspaceId, fromNodeId: runNode.id, toNodeId: skillNodeId, relation: "used_skill", weight: 0.7 });
      edges++;
    }
    nodes++;
  }

  return {
    nodes,
    edges,
    lessons: lessons.length,
    decisions: decisions.length,
    projects: projects.length,
    runs: runTelemetries.length,
    requirements: requirementNodeByReqId.size,
    skills: skillNodeBySlug.size,
  };
}
