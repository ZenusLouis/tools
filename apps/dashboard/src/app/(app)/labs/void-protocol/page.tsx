import { ConceptScreen } from "@/components/labs/ConceptScreen";
import { requireCurrentUser } from "@/lib/auth";
import { getLabMetrics } from "@/lib/lab-metrics";

export default async function VoidProtocolPage() {
  const user = await requireCurrentUser();
  return <ConceptScreen kind="protocol" metrics={await getLabMetrics(user.workspaceId)} />;
}
