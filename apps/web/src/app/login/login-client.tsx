"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { AnimatedCharactersLoginPage } from "@/components/ui/animated-characters-login-page";
import { PalcoAuthShell, palcoForm as f } from "@/components/admin/palco-auth";

export function LoginClient() {
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

  async function onSubmit(email: string, password: string, rememberMe = true) {
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password, rememberMe });
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
    <PalcoAuthShell eyebrow="Verificação em duas etapas" title="Confirme que é você." description={backup ? "Digite um dos códigos de recuperação que você salvou." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}>
      <form onSubmit={verifySecondFactor} className={f.form} aria-labelledby="auth-title">
        <div className={f.field}><label htmlFor="second-factor" className={f.label}>{backup ? "Código de recuperação" : "Código do autenticador"}</label>
          <div className={f.input}><input id="second-factor" autoFocus autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} value={code} onChange={e => setCode(e.target.value)} required maxLength={backup ? 64 : 6} /></div></div>
        {error && <p role="alert" className={f.error}>{error}</p>}
        <button type="submit" className={f.submit} disabled={loading}>{loading ? "Validando…" : "Confirmar acesso"}</button>
        <button type="button" className={f.secondary} disabled={loading} onClick={() => { setBackup(!backup); setCode(""); setError(null); }}>{backup ? "Usar aplicativo autenticador" : "Usar código de recuperação"}</button>
        <button type="button" className={f.secondary} disabled={loading} onClick={() => { setChallenge(false); setCode(""); setError(null); }}>Voltar ao login</button>
      </form>
    </PalcoAuthShell>
  );

  return <AnimatedCharactersLoginPage onSubmit={onSubmit} error={error} loading={loading} />;
}
