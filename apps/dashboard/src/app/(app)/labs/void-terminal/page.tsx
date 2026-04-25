import { ConceptScreen } from "@/components/labs/ConceptScreen";
import { requireCurrentUser } from "@/lib/auth";
import { getLabMetrics } from "@/lib/lab-metrics";

export default async function VoidTerminalPage() {
  const user = await requireCurrentUser();
  return <ConceptScreen kind="terminal" metrics={await getLabMetrics(user.workspaceId)} />;
}
