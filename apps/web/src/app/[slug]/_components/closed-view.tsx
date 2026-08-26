import type { PublicWebinar } from "@/lib/public-dto";

export function ClosedView({ w }: { w: PublicWebinar }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-16 object-contain" /> : null}
      <h1 className="text-2xl font-semibold">{w.title}</h1>
      <p className="mt-3 text-muted-foreground">Você chegou tarde... Essa aula já foi encerrada!</p>
      {w.closedGroupUrl ? (
        <>
          <p className="mt-6 text-sm font-medium">Para participar da próxima, entre no nosso grupo:</p>
          <a
            href={w.closedGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow"
            style={{ backgroundColor: w.loginButtonColor }}
          >
            Entrar no grupo
          </a>
        </>
      ) : null}
    </main>
  );
}
