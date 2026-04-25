"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

const TEMPLATE_ROOT = path.resolve(process.cwd(), "..", "..", "projects", "generated");

type ScaffoldResult = { ok: boolean; name?: string; path?: string; error?: string };

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gcs-app";
}

export async function scaffoldTemplate(_prev: unknown, formData: FormData): Promise<ScaffoldResult> {
  const user = await requireCurrentUser();
  const name = slugify(String(formData.get("name") ?? "gcs-app"));
  const framework = String(formData.get("framework") ?? "nextjs");
  const target = path.join(TEMPLATE_ROOT, name);

  try {
    await fs.mkdir(target, { recursive: false });
    await fs.mkdir(path.join(target, "src"), { recursive: true });
    await fs.writeFile(path.join(target, "README.md"), `# ${name}\n\nGenerated from GCS template: ${framework}.\n`, "utf8");
    await fs.writeFile(path.join(target, "package.json"), JSON.stringify({
      name,
      version: "0.1.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", lint: "next lint" },
      dependencies: framework === "nextjs" ? { next: "latest", react: "latest", "react-dom": "latest" } : {},
    }, null, 2), "utf8");
    await fs.writeFile(path.join(target, "src", "index.md"), `# ${name}\n\nStart building here.\n`, "utf8");

    await db.project.create({
      data: {
        name,
        workspaceId: user.workspaceId,
        path: target,
        frameworks: [framework],
        lastIndexed: new Date(),
        docs: {},
        links: {},
      },
    });
    await db.module.create({
      data: { id: `${name}-M0`, projectName: name, name: "Generated Starter", order: 0 },
    });
    await db.feature.create({
      data: { id: `${name}-M0-F0`, moduleId: `${name}-M0`, name: "Initial Setup", order: 0 },
    });
    await db.task.create({
      data: {
        id: `${name}-M0-F0-T1`,
        workspaceId: user.workspaceId,
        featureId: `${name}-M0-F0`,
        name: "Customize generated starter",
        status: "pending",
        phase: "pending",
        estimate: "1h",
        deps: [],
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    return { ok: true, name, path: target };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
