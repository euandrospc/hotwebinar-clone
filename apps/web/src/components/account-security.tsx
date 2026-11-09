"use client";

import { ShieldCheck } from "@/components/icons";
import styles from "@/components/management-v2.module.css";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AccountSecurity() {
  const { data: session } = authClient.useSession();
  const enabled = session?.user.twoFactorEnabled === true;
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; qr: string; codes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function beginSetup() {
    const result = await authClient.twoFactor.enable({ password });
    if (result.error || !result.data || result.data.method !== "totp") throw new Error("Não foi possível iniciar. Confira sua senha atual.");
    const { default: QRCode } = await import("qrcode");
    const qr = await QRCode.toDataURL(result.data.totpURI, { width: 240, margin: 2 });
    setSetup({ uri: result.data.totpURI, qr, codes: result.data.backupCodes });
    setPassword(""); setCode(""); setSaved(false);
  }

  async function confirmSetup() {
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) throw new Error("Código inválido ou expirado. Confira o autenticador.");
    const revoked = await authClient.revokeOtherSessions();
    setSetup(null); setCode(""); setSaved(false);
    await authClient.getSession({ query: { disableCookieCache: true } });
    if (revoked.error) throw new Error("2FA ativado. Não foi possível encerrar as outras sessões; tente novamente abaixo.");
    toast.success("2FA ativado e outras sessões encerradas");
  }

  function downloadCodes() {
    if (!setup) return;
    const blob = new Blob([`Bravy Lives · Códigos de recuperação\nConta: ${session?.user.email}\nCada código pode ser usado uma única vez. Guarde em local seguro.\n\n${setup.codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "bravy-codigos-recuperacao.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className={`${styles.surface} ${styles.security} ${styles.form}`}>
      <div className={styles.securityHeader}><span className={styles.iconBadge}><ShieldCheck aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className={styles.sectionTitle}>Segurança da conta</h2><p className={`${styles.description} break-all`}>{session?.user.email}</p></div><span className={styles.status} data-status={enabled ? "active" : "QUEUED"}>{enabled ? "2FA ativo" : "2FA inativo"}</span></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className={styles.inset}>
        <h3 className="font-medium">Autenticação em duas etapas</h3>
        <p className="text-sm text-muted-foreground">{enabled ? "Ativada. Seu login exige senha e um código do autenticador." : "Proteja seu acesso com Google Authenticator, 1Password ou outro aplicativo autenticador."}</p>
        {!setup && <div className="space-y-2"><Label htmlFor="security-password">Senha atual</Label><Input id="security-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>}
        {!enabled && !setup && <Button className={styles.primaryButton} disabled={busy || !password} onClick={() => void perform(beginSetup)}>Configurar 2FA</Button>}
        {setup && <div className="space-y-4">
          <p className="text-sm">1. Escaneie este QR code no seu autenticador.</p>
          {/* The QR is generated locally; the enrollment secret never goes to an external service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code para configurar o autenticador" width={240} height={240} className="mx-auto max-w-full rounded-xl" />
          <details className="text-sm"><summary className="cursor-pointer">Não consigo escanear</summary><p className="mt-2 break-all rounded bg-muted p-2 font-mono">{new URL(setup.uri).searchParams.get("secret")}</p></details>
          <p className="text-sm">2. Guarde estes códigos de recuperação. Cada um funciona uma única vez.</p>
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-muted/60 p-3 font-mono text-xs sm:grid-cols-2">{setup.codes.map(item => <span key={item}>{item}</span>)}</div>
          <Button type="button" className={styles.secondaryButton} variant="outline" onClick={downloadCodes}>Baixar códigos</Button>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-1" /> Guardei meus códigos em um local seguro.</label>
          <div className="space-y-2"><Label htmlFor="enrollment-code">3. Código do autenticador</Label><Input id="enrollment-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="flex flex-wrap gap-2"><Button className={styles.primaryButton} disabled={busy || !saved || code.length !== 6} onClick={() => void perform(confirmSetup)}>Confirmar e ativar 2FA</Button><Button className={styles.secondaryButton} variant="ghost" disabled={busy} onClick={() => { setSetup(null); setCode(""); }}>Cancelar</Button></div>
        </div>}
        {enabled && <Button className={styles.secondaryButton} variant="outline" disabled={busy || !password} onClick={() => void perform(async () => {
          const result = await authClient.twoFactor.disable({ password });
          if (result.error) throw new Error("Não foi possível desativar. Confira sua senha atual.");
          setPassword(""); await authClient.getSession({ query: { disableCookieCache: true } }); toast.success("2FA desativado");
        })}>Desativar 2FA</Button>}
      </div>
      {!setup && <form className={styles.inset} onSubmit={event => { event.preventDefault(); void perform(async () => {
        if (nextPassword !== confirmation) throw new Error("As novas senhas não coincidem.");
        const result = await authClient.changePassword({ currentPassword: password, newPassword: nextPassword, revokeOtherSessions: true });
        if (result.error) throw new Error("Não foi possível trocar a senha. Confira a senha atual e use ao menos 12 caracteres na nova senha.");
        setPassword(""); setNextPassword(""); setConfirmation(""); toast.success("Senha alterada e outras sessões encerradas");
      }); }}>
        <h3 className="font-medium">Trocar senha</h3>
        <div className="space-y-2"><Label htmlFor="new-account-password">Nova senha</Label><Input id="new-account-password" type="password" autoComplete="new-password" minLength={12} required value={nextPassword} onChange={e => setNextPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="confirm-account-password">Confirmar nova senha</Label><Input id="confirm-account-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        <Button className={styles.primaryButton} disabled={busy || !password} type="submit">Alterar senha</Button>
      </form>}
      <div className={styles.sessionRow}><p className={styles.meta}>Desconecte os outros dispositivos.</p><Button className={styles.secondaryButton} variant="outline" disabled={busy} onClick={() => void perform(async () => {
        const result = await authClient.revokeOtherSessions();
        if (result.error) throw new Error("Não foi possível encerrar as outras sessões.");
        toast.success("Outras sessões encerradas");
      })}>Encerrar outras sessões</Button></div>
    </section>
  );
}
