import type { PublicWebinar } from "@/lib/public-dto";

export function ClosedView({ w }: { w: PublicWebinar }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-16 object-contain" /> : null}
      <h1 className="text-2xl font-semibold">{w.title}</h1>
      <p className="mt-3 text-muted-foreground">Este webinar já foi encerrado.</p>
    </main>
  );
}
