import "server-only";
import { db } from "@/lib/db";

export type Lesson = {
  framework: string;
  text: string;
  date: string | null;
};

export async function getRandomLessons(count = 3): Promise<Lesson[]> {
  // Seeded-random by day so same lessons show for the whole day
  const all = await db.lesson.findMany({ orderBy: { framework: "asc" } });
  if (all.length === 0) return [];

  const seed = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ""), 10);
  const shuffled = [...all].sort((a, b) => {
    const ha = (seed ^ a.id.charCodeAt(0)) % 997;
    const hb = (seed ^ b.id.charCodeAt(0)) % 997;
    return ha - hb;
  });

  return shuffled.slice(0, count).map((l) => ({
    framework: l.framework,
    text: l.text,
    date: l.date?.toISOString().slice(0, 10) ?? null,
  }));
}
