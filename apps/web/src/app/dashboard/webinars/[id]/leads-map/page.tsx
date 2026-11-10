import { redirect } from "next/navigation";

// Preserve saved links; the audience map now lives in the realtime panel.
export default async function LegacyWebinarMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/webinars/${encodeURIComponent(id)}/realtime`);
}
