import { AuditDashboard } from "@/components/AuditDashboard";
import { getAudit } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  return <AuditDashboard initialData={await getAudit()}/>;
}
