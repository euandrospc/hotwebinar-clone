import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { ChatAiSettings } from "./settings";
export default async function ChatAiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="container mx-auto py-6"><WebinarTabs webinarId={id} /><ChatAiSettings webinarId={id} /></div>;
}
