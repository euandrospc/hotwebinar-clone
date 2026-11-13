"use client";

import { ChevronDown, LockKeyhole, LogOut, ShieldCheck, Smartphone, TriangleAlert, TvMinimalPlay } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { revokeAccountSession, type AccountSession } from "@/server/actions/settings";
import { PasswordInput, SettingsField, SettingsSection, settingsUi } from "@/components/settings-section";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 12;
const SESSION_PREVIEW = 3;

export function AccountSecurity({ email, sessions }: { email: string; sessions: AccountSession[] }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const enabled = session?.user.twoFactorEnabled === true;
  // 2FA panel: idle -> asks the current password -> (enable only) QR enrollment.
  const [stage, setStage] = useState<"idle" | "password" | "setup">("idle");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; qr: string; codes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);

  async function perform(setError: (message: string) => void, action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  function resetTwoFactor() {
    setStage("idle"); setSetup(null); setCode(""); setSaved(false); setTwoFactorPassword(""); setTwoFactorError("");
  }

  async function beginSetup() {
    const result = await authClient.twoFactor.enable({ password: twoFactorPassword });
    if (result.error || !result.data || result.data.method !== "totp") throw new Error("Não foi possível iniciar. Confira sua senha atual.");
    const { default: QRCode } = await import("qrcode");
    const qr = await QRCode.toDataURL(result.data.totpURI, { width: 240, margin: 2 });
    setSetup({ uri: result.data.totpURI, qr, codes: result.data.backupCodes });
    setStage("setup"); setTwoFactorPassword(""); setCode(""); setSaved(false);
  }

  async function confirmSetup() {
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) throw new Error("Código inválido ou expirado. Confira o autenticador.");
    const revoked = await authClient.revokeOtherSessions();
    resetTwoFactor();
    await authClient.getSession({ query: { disableCookieCache: true } });
    router.refresh();
    if (revoked.error) throw new Error("2FA ativado. Não foi possível encerrar as outras sessões; tente novamente em Sessões ativas.");
    toast.success("2FA ativado e outras sessões encerradas");
  }

  async function disableTwoFactor() {
    const result = await authClient.twoFactor.disable({ password: twoFactorPassword });
    if (result.error) throw new Error("Não foi possível desativar. Confira sua senha atual.");
    resetTwoFactor();
    await authClient.getSession({ query: { disableCookieCache: true } });
    toast.success("2FA desativado");
  }

  function downloadCodes() {
    if (!setup) return;
    const blob = new Blob([`Bravy Lives · Códigos de recuperação\nConta: ${email}\nCada código pode ser usado uma única vez. Guarde em local seguro.\n\n${setup.codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "bravy-codigos-recuperacao.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const others = sessions.filter(item => !item.current);
  // Sessions arrive current-first, then most recent; keep the card compact like the design.
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, SESSION_PREVIEW);

  return (
    <>
      <SettingsSection icon={<ShieldCheck />} title="Autenticação em duas etapas" description="Um código do app autenticador é pedido a cada login. Funciona com Google Authenticator, 1Password e similares.">
        <div className={settingsUi.card}>
          <div className={cn("flex flex-wrap items-center gap-3.5 rounded-xl border p-3.5", enabled ? "border-palco/20 bg-palco/[0.05]" : "border-[#F5B742]/20 bg-[#F5B742]/[0.05]")}>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-[17px]", enabled ? "bg-palco/[0.12] text-palco" : "bg-[#F5B742]/[0.12] text-[#F5B742]")} aria-hidden="true">
              {enabled ? <ShieldCheck /> : <TriangleAlert />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className={cn("text-sm font-bold", enabled ? "text-palco" : "text-[#F5B742]")}>{enabled ? "2FA ativado" : "2FA desativado"}</p>
              <p className="text-[13px] text-[#C9D1CA]">{enabled ? "Seu login exige a senha e um código do autenticador." : "Sua conta está protegida só pela senha."}</p>
            </div>
            {stage === "idle" && (enabled
              ? <button type="button" className={settingsUi.secondary} onClick={() => setStage("password")}>Desativar 2FA</button>
              : <button type="button" className={settingsUi.primary} onClick={() => setStage("password")}><ShieldCheck aria-hidden="true" />Ativar 2FA</button>)}
          </div>
          {stage === "password" && <form className="flex flex-col gap-[18px]" onSubmit={event => { event.preventDefault(); void perform(setTwoFactorError, enabled ? disableTwoFactor : beginSetup); }}>
            <SettingsField id="two-factor-password" label="Confirme sua senha atual" error={twoFactorError}>
              <PasswordInput id="two-factor-password" autoComplete="current-password" required autoFocus value={twoFactorPassword} onChange={e => setTwoFactorPassword(e.target.value)} />
            </SettingsField>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={settingsUi.secondary} disabled={busy} onClick={resetTwoFactor}>Cancelar</button>
              <button type="submit" className={settingsUi.primary} disabled={busy || !twoFactorPassword}>{enabled ? "Desativar 2FA" : "Continuar"}</button>
            </div>
          </form>}
          {stage === "setup" && setup && <div className="flex flex-col gap-4 text-[13px] text-[#C9D1CA]">
            <p>1. Escaneie este QR code no seu autenticador.</p>
            {/* The QR is generated locally; the enrollment secret never goes to an external service. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code para configurar o autenticador" width={240} height={240} className="mx-auto max-w-full rounded-xl" />
            <details><summary className="cursor-pointer text-[#9AA39C]">Não consigo escanear</summary><p className="mt-2 break-all rounded-[10px] bg-[#070807] p-2 font-mono">{new URL(setup.uri).searchParams.get("secret")}</p></details>
            <p>2. Guarde estes códigos de recuperação. Cada um funciona uma única vez.</p>
            <div className="grid grid-cols-1 gap-2 rounded-[10px] border border-[#1E241F] bg-[#070807] p-3 font-mono text-xs text-neutral-100 sm:grid-cols-2">{setup.codes.map(item => <span key={item}>{item}</span>)}</div>
            <button type="button" className={cn(settingsUi.secondary, "self-start")} onClick={downloadCodes}>Baixar códigos</button>
            <label className="flex items-start gap-2"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-0.5 accent-[#2BE07A]" /> Guardei meus códigos em um local seguro.</label>
            <SettingsField id="enrollment-code" label="3. Código do autenticador" error={twoFactorError}>
              <input id="enrollment-code" className={settingsUi.input} autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />
            </SettingsField>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={settingsUi.secondary} disabled={busy} onClick={resetTwoFactor}>Cancelar</button>
              <button type="button" className={settingsUi.primary} disabled={busy || !saved || code.length !== 6} onClick={() => void perform(setTwoFactorError, confirmSetup)}>Confirmar e ativar 2FA</button>
            </div>
          </div>}
          {stage === "idle" && twoFactorError && <p role="alert" className={settingsUi.error}>{twoFactorError}</p>}
        </div>
      </SettingsSection>

      <SettingsSection icon={<LockKeyhole />} title="Senha" description={`Use pelo menos ${MIN_PASSWORD} caracteres. Ao trocar, as outras sessões são encerradas.`}>
        <form className={settingsUi.card} onSubmit={event => { event.preventDefault(); void perform(setPasswordError, async () => {
          if (nextPassword !== confirmation) throw new Error("As novas senhas não coincidem.");
          const result = await authClient.changePassword({ currentPassword: password, newPassword: nextPassword, revokeOtherSessions: true });
          if (result.error) throw new Error(`Não foi possível trocar a senha. Confira a senha atual e use ao menos ${MIN_PASSWORD} caracteres na nova senha.`);
          setPassword(""); setNextPassword(""); setConfirmation(""); router.refresh();
          toast.success("Senha alterada e outras sessões encerradas");
        }); }}>
          <SettingsField id="current-account-password" label="Senha atual">
            <PasswordInput id="current-account-password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </SettingsField>
          <div className="flex flex-col gap-4 sm:flex-row">
            <SettingsField id="new-account-password" label="Nova senha">
              <PasswordInput id="new-account-password" autoComplete="new-password" minLength={MIN_PASSWORD} required placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} value={nextPassword} onChange={e => setNextPassword(e.target.value)} />
            </SettingsField>
            <SettingsField id="confirm-account-password" label="Confirmar nova senha">
              <PasswordInput id="confirm-account-password" autoComplete="new-password" minLength={MIN_PASSWORD} required placeholder="Repita a nova senha" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            </SettingsField>
          </div>
          {passwordError && <p role="alert" className={settingsUi.error}>{passwordError}</p>}
          <div className={settingsUi.footer}>
            <p className={settingsUi.hint}>Você continua conectado neste dispositivo</p>
            <button className={settingsUi.secondary} disabled={busy} type="submit">Alterar senha</button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection icon={<TvMinimalPlay />} title="Sessões ativas" description={<>Dispositivos conectados à sua conta <span className="break-all">{email}</span>.</>}>
        <div className={settingsUi.card}>
          <ul id="account-sessions" className={cn("flex flex-col", showAllSessions && "max-h-[432px] overflow-y-auto overscroll-contain pr-1")}>
            {visibleSessions.map((item, index) => (
              <li key={item.id} className={cn("flex items-center gap-3.5 py-3", index > 0 && "border-t border-[#1A1F1B]")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#1A1F1B] text-[#9AA39C] [&_svg]:size-4" aria-hidden="true">
                  {item.mobile ? <Smartphone /> : <TvMinimalPlay />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-100">{item.label}</p>
                    {item.current && <span className="rounded-full bg-palco/[0.12] px-2 py-px text-[11px] font-bold text-palco">este dispositivo</span>}
                  </div>
                  <p className="text-xs text-[#7C867E]">{[item.location, item.lastActive].filter(Boolean).join(" · ")}</p>
                </div>
                {!item.current && <button type="button" disabled={busy} className="rounded-md px-1 text-[13px] font-semibold text-[#9AA39C] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 disabled:opacity-50" aria-label={`Encerrar sessão ${item.label}`} onClick={() => void perform(setSessionError, async () => {
                  const result = await revokeAccountSession(item.id);
                  if ("error" in result) throw new Error(result.error.message);
                  router.refresh();
                  toast.success("Sessão encerrada");
                })}>Encerrar</button>}
              </li>
            ))}
          </ul>
          {sessions.length > SESSION_PREVIEW && <button type="button" aria-expanded={showAllSessions} aria-controls="account-sessions" onClick={() => setShowAllSessions(v => !v)} className="-mt-[18px] flex items-center justify-center gap-1.5 rounded-md border-t border-[#1A1F1B] pt-3 text-[13px] font-semibold text-[#9AA39C] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 [&_svg]:size-[15px] [&_svg]:transition-transform motion-reduce:[&_svg]:transition-none">
            {showAllSessions ? "Mostrar menos" : `Ver todas as ${sessions.length} sessões`}
            <ChevronDown aria-hidden="true" className={cn(showAllSessions && "rotate-180")} />
          </button>}
          {sessionError && <p role="alert" className={settingsUi.error}>{sessionError}</p>}
          <div className={settingsUi.footer}>
            <p className={settingsUi.hint}>{others.length ? "Desconecta todos os outros dispositivos de uma vez" : "Nenhum outro dispositivo conectado"}</p>
            <button type="button" className={cn(settingsUi.secondary, "border-[#F0605A]/35 text-[#F0605A] hover:bg-[#F0605A]/10")} disabled={busy || !others.length} onClick={() => void perform(setSessionError, async () => {
              const result = await authClient.revokeOtherSessions();
              if (result.error) throw new Error("Não foi possível encerrar as outras sessões.");
              router.refresh();
              toast.success("Outras sessões encerradas");
            })}><LogOut aria-hidden="true" />Encerrar outras sessões</button>
          </div>
        </div>
      </SettingsSection>
    </>
  );
}
