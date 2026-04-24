import "server-only";
import { db } from "@/lib/db";

export type Lesson = {
  framework: string;
  text: string;
  date: string | null;
};

export type Decision = {
  id: string;
  title: string;
  body: string;
};

export type ProjectDecisions = {
  project: string;
  decisions: Decision[];
};

export async function getAllLessons(): Promise<Lesson[]> {
  const rows = await db.lesson.findMany({ orderBy: [{ framework: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({ framework: r.framework, text: r.text, date: r.date?.toISOString().slice(0, 10) ?? null }));
}

export function getFrameworks(lessons: Lesson[]): string[] {
  return [...new Set(lessons.map((l) => l.framework))].sort();
}

export async function getProjectDecisions(projectName: string): Promise<Decision[]> {
  const rows = await db.decision.findMany({ where: { projectName }, orderBy: { decisionKey: "asc" } });
  return rows.map((r) => ({ id: r.decisionKey, title: r.title, body: r.body }));
}

export async function getAllProjectDecisions(): Promise<ProjectDecisions[]> {
  const rows = await db.decision.findMany({ orderBy: [{ projectName: "asc" }, { decisionKey: "asc" }] });
  const map = new Map<string, Decision[]>();
  for (const r of rows) {
    const list = map.get(r.projectName) ?? [];
    list.push({ id: r.decisionKey, title: r.title, body: r.body });
    map.set(r.projectName, list);
  }
  return [...map.entries()].map(([project, decisions]) => ({ project, decisions }));
}

export async function appendLesson(framework: string, text: string): Promise<void> {
  await db.lesson.create({ data: { framework, text, date: new Date() } });
}

export async function updateLesson(original: Lesson, newText: string): Promise<void> {
  await db.lesson.updateMany({
    where: { framework: original.framework, text: original.text },
    data: { text: newText, date: new Date() },
  });
}

export async function deleteLesson(lesson: Lesson): Promise<void> {
  await db.lesson.deleteMany({ where: { framework: lesson.framework, text: lesson.text } });
}
