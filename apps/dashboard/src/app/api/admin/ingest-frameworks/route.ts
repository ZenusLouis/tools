import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

// Recursively find all SKILL.md files
function findSkillFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findSkillFiles(filePath, fileList);
    } else if (file === "SKILL.md") {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export async function POST() {
  try {
    // Determine repo root: In Docker it's /data, locally it's ../../
    let repoRoot = path.resolve(process.cwd(), "../../");
    if (fs.existsSync("/data/agents") && fs.existsSync("/data/skills")) {
      repoRoot = "/data";
    }

    // 1. Ingest Commands
    const commandsDir = path.join(repoRoot, "agents", "commands");
    let commandsIngested = 0;
    if (fs.existsSync(commandsDir)) {
      const files = fs.readdirSync(commandsDir);
      for (const file of files) {
        if (file.endsWith(".md") && file !== "README.md") {
          const content = fs.readFileSync(path.join(commandsDir, file), "utf-8");
          const slug = file.replace(".md", "");
          await db.commandTemplate.upsert({
            where: { workspaceId_slug: { workspaceId: "global", slug } },
            update: { content },
            create: { slug, content, workspaceId: "global" },
          });
          commandsIngested++;
        }
      }
    }

    // 2. Ingest Memory/Lessons
    const memoryDir = path.join(repoRoot, "agents", "learning");
    let lessonsIngested = 0;
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir);
      for (const file of files) {
        if (file.endsWith(".md") && file !== "README.md") {
          const content = fs.readFileSync(path.join(memoryDir, file), "utf-8");
          const framework = file.replace(".md", "");
          
          // Check if lesson exists
          const existing = await db.lesson.findFirst({ where: { framework } });
          if (existing) {
            await db.lesson.update({ where: { id: existing.id }, data: { text: content } });
          } else {
            await db.lesson.create({ data: { framework, text: content } });
          }
          lessonsIngested++;
        }
      }
    }

    // 3. Update Skill Definitions with content
    const skillsDir = path.join(repoRoot, "skills");
    let skillsIngested = 0;
    const skillFiles = findSkillFiles(skillsDir);
    
    for (const skillFile of skillFiles) {
      // Path looks like /skills/frameworks/react/SKILL.md
      // We extract "react" as the slug
      const parts = skillFile.split(path.sep);
      const slug = parts[parts.length - 2];
      const content = fs.readFileSync(skillFile, "utf-8");
      
      // Update existing skill if found
      const existingSkill = await db.skillDefinition.findFirst({ where: { slug } });
      if (existingSkill) {
        await db.skillDefinition.update({
          where: { id: existingSkill.id },
          data: { content },
        });
        skillsIngested++;
      }
    }

    return NextResponse.json({
      success: true,
      commandsIngested,
      lessonsIngested,
      skillsIngested,
      message: "Successfully ingested frameworks into database.",
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ingestion failed" }, { status: 500 });
  }
}
