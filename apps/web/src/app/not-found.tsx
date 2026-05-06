import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
      <Link href="/webinars" className="mt-6 text-sm text-primary underline">
        Ver webinars
      </Link>
    </main>
  );
}
