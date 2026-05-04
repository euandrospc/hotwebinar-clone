import { redirect } from "next/navigation";
import { createDraftWebinar } from "@/server/actions/webinar";

export default async function NewWebinarPage() {
  const { id } = await createDraftWebinar();
  redirect(`/dashboard/webinars/${id}/step-1`);
}
