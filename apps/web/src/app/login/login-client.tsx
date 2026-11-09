"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedCharactersLoginPage } from "@/components/ui/animated-characters-login-page";

import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import styles from "@/components/admin/admin-auth-frame.module.css";

export function LoginClient({ brandName }: { brandName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(false);
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  function finishLogin() {
    const raw = new URLSearchParams(window.location.search).get("from");
    const target = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
    router.push(target);
    router.refresh();
  }

  async function verifySecondFactor(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setLoading(true);
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (result.error) { setError("Código inválido ou expirado. Tente novamente."); return; }
      finishLogin();
    } catch { setError("Não foi possível validar o código. Tente novamente."); }
    finally { setLoading(false); }
  }

  async function onSubmit(email: string, password: string) {
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError("Credenciais inválidas");
      return;
    }
    if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
      setChallenge(true);
      return;
    }
    finishLogin();
  }

  if (challenge) return (
    <AdminAuthFrame title="Verificação em duas etapas" description={backup ? "Digite um dos códigos de recuperação que você salvou." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}>
      <form onSubmit={verifySecondFactor} className={styles.form}>
        <div className={styles.field}><Label htmlFor="second-factor" className={styles.label}>{backup ? "Código de recuperação" : "Código do autenticador"}</Label>
          <Input className={styles.input} id="second-factor" autoFocus autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} value={code} onChange={e => setCode(e.target.value)} required maxLength={backup ? 64 : 6} /></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <Button type="submit" className={styles.submit} disabled={loading}>{loading ? "Validando…" : "Confirmar acesso"}</Button>
        <Button type="button" variant="ghost" className={styles.secondary} disabled={loading} onClick={() => { setBackup(!backup); setCode(""); setError(null); }}>{backup ? "Usar aplicativo autenticador" : "Usar código de recuperação"}</Button>
        <Button type="button" variant="ghost" className={styles.secondary} disabled={loading} onClick={() => { setChallenge(false); setCode(""); setError(null); }}>Voltar ao login</Button>
      </form>
    </AdminAuthFrame>
  );

  return (
    <AnimatedCharactersLoginPage
      title={brandName}
      subtitle="Entre com seus dados"
      submitLabel="Entrar"
      loadingLabel="Entrando..."
      onSubmit={onSubmit}
      error={error}
      loading={loading}
    />
  );
}
