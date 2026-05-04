import { redirect } from "next/navigation";

export default async function WebinarRoot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/webinars/${id}/step-1`);
}
