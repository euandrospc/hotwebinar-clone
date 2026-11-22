"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedCharactersLoginPage } from "@/components/ui/animated-characters-login-page";

import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { sameOriginPath } from "@/lib/sso-redirect";
import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import styles from "@/components/admin/admin-auth-frame.module.css";

// Codes Better Auth appends as ?error= when the Bravy ID callback fails
const SSO_ERRORS: Record<string, string> = {
  signup_disabled: "Seu Bravy ID ainda não tem acesso aqui. Peça a um administrador para criar seu usuário com este e-mail.",
  account_not_linked: "Já existe um usuário com este e-mail, mas o Bravy ID não confirmou o e-mail. Entre com e-mail e senha.",
  unable_to_link_account: "Não foi possível vincular o Bravy ID ao seu usuário.",
  email_not_found: "O Bravy ID não informou um e-mail.",
  access_denied: "Acesso negado no Bravy ID."
};

function ssoErrorMessage(code: string | undefined) {
  if (!code) return null;
  return SSO_ERRORS[code] ?? "Não foi possível entrar com Bravy ID. Tente novamente.";
}

function BravyIdButton({ callbackURL, onError }: { callbackURL: () => string; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      className={styles.sso}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        // On success the browser is already on its way to Bravy ID
        const { error } = await authClient.signIn.social({ provider: "bravy-id", callbackURL: callbackURL(), errorCallbackURL: ADMIN_LOGIN_PATH });
        if (error) {
          setLoading(false);
          onError("Não foi possível abrir o Bravy ID. Tente novamente.");
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://iam.bravy.com.br/static/mark-bravy.svg" alt="" width={15} height={15} />
      {loading ? "Redirecionando…" : "Entrar com Bravy ID"}
    </button>
  );
}

export function LoginClient({ brandName, ssoError }: { brandName: string; ssoError?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(() => ssoErrorMessage(ssoError));
  const [challenge, setChallenge] = useState(false);
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  function loginTarget() {
    return sameOriginPath(new URLSearchParams(window.location.search).get("from"), window.location.origin);
  }

  function finishLogin() {
    router.push(loginTarget());
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
      beforeForm={<>
        <BravyIdButton callbackURL={loginTarget} onError={setError} />
        <div className={styles.divider}>ou</div>
      </>}
    />
  );
}
