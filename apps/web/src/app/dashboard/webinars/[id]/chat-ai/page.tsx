import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { ChatAiSettings } from "./settings";

export const metadata: Metadata = { title: "Agente de IA" };
export default async function ChatAiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPage><WebinarTabs webinarId={id} /><ChatAiSettings webinarId={id} /></AdminPage>;
}
