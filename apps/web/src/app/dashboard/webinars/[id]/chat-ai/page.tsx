import { AdminPage } from "@/components/admin/admin-page";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { ChatAiSettings } from "./settings";
export default async function ChatAiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPage><WebinarTabs webinarId={id} /><ChatAiSettings webinarId={id} /></AdminPage>;
}
