import { CommandCenterDashboard } from "@/components/CommandCenterDashboard";
import { getCommandCenter } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  return <CommandCenterDashboard initialData={await getCommandCenter()}/>;
}
