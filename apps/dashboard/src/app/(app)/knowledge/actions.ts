"use server";

import { revalidatePath } from "next/cache";
import { appendLesson, updateLesson, deleteLesson, type Lesson } from "@/lib/knowledge";

export async function addLessonAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const framework = (formData.get("framework") as string)?.trim();
  const text = (formData.get("text") as string)?.trim();
  if (!framework || !text) return { error: "Framework and text are required" };
  await appendLesson(framework, text);
  revalidatePath("/knowledge");
  return { ok: true };
}

export async function editLessonAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const originalJson = formData.get("original") as string;
  const newText = (formData.get("text") as string)?.trim();
  if (!originalJson || !newText) return { error: "Missing data" };
  try {
    const original: Lesson = JSON.parse(originalJson);
    await updateLesson(original, newText);
    revalidatePath("/knowledge");
    return { ok: true };
  } catch {
    return { error: "Failed to update lesson" };
  }
}

export async function deleteLessonAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const lessonJson = formData.get("lesson") as string;
  if (!lessonJson) return { error: "Missing lesson data" };
  try {
    const lesson: Lesson = JSON.parse(lessonJson);
    await deleteLesson(lesson);
    revalidatePath("/knowledge");
    return { ok: true };
  } catch {
    return { error: "Failed to delete lesson" };
  }
}
