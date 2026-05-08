"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { AnimatedCharactersLoginPage } from "@/components/ui/animated-characters-login-page";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(email: string, password: string) {
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError("Credenciais inválidas");
      return;
    }
    const raw = new URLSearchParams(window.location.search).get("from");
    const target = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
    router.push(target);
  }

  return (
    <AnimatedCharactersLoginPage
      title="Bem-vindo de volta"
      subtitle="Entre com seus dados"
      submitLabel="Entrar"
      loadingLabel="Entrando..."
      onSubmit={onSubmit}
      error={error}
      loading={loading}
    />
  );
}
