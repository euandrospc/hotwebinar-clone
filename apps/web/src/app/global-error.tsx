"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
          <h1>Erro interno</h1>
          <button type="button" onClick={() => reset()} style={{ marginTop: 16, padding: "8px 16px" }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
