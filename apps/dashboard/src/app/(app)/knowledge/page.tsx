import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";
import { getAllLessons, getFrameworks, getAllProjectDecisions } from "@/lib/knowledge";
import { readJSON } from "@/lib/fs/json";
import { resolvePath } from "@/lib/fs/resolve";

type Registry = Record<string, string>;

export default async function KnowledgePage() {
  const [lessons, projectDecisions] = await Promise.all([
    getAllLessons(),
    getAllProjectDecisions(),
  ]);

  const frameworks = getFrameworks(lessons);

  let projectNames: string[] = [];
  try {
    const registry = await readJSON<Registry>(resolvePath("projects", "registry.json"));
    projectNames = Object.keys(registry).sort();
  } catch { /* ignore */ }

  return (
    <>
      <TopBar title="Knowledge Base" />
      <PageShell>
        <KnowledgeClient
          lessons={lessons}
          frameworks={frameworks}
          projectDecisions={projectDecisions}
          projectNames={projectNames}
        />
      </PageShell>
    </>
  );
}
