import { ConceptScreen } from "@/components/labs/ConceptScreen";
import { requireCurrentUser } from "@/lib/auth";
import { getLabMetrics } from "@/lib/lab-metrics";

export default async function PremiumDashboardPage() {
  const user = await requireCurrentUser();
  return <ConceptScreen kind="premium" metrics={await getLabMetrics(user.workspaceId)} />;
}
