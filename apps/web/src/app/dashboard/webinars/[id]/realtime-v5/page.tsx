import { permanentRedirect } from "next/navigation";

export default async function RealtimeV5Redirect({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, entry);
    }
  }
  const suffix = query.toString();
  permanentRedirect(`/dashboard/webinars/${encodeURIComponent(id)}/v5${suffix ? `?${suffix}` : ""}`);
}
