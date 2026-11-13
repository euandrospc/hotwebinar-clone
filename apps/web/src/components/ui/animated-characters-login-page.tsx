"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock } from "@/components/icons";
import { PalcoAuthShell, palcoForm as f } from "@/components/admin/palco-auth";

// Retain the public component contract used by the login and 2FA flow.
export interface AnimatedCharactersLoginPageProps {
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loadingLabel?: string;
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void> | void;
  error?: string | null;
  loading?: boolean;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
  </svg>;
}

export function AnimatedCharactersLoginPage({ title = "Acesse sua conta e veja suas salas vendendo.", subtitle = "Webinários automáticos, métricas de conversão e vendas em tempo real, tudo em um só painel.", submitLabel = "Acessar sua conta", loadingLabel = "Entrando...", onSubmit, error = null, loading = false }: AnimatedCharactersLoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  return <PalcoAuthShell eyebrow="Painel do produtor" title={title} description={subtitle}>
    <form onSubmit={async event => { event.preventDefault(); await onSubmit(email, password, remember); }} className={f.form} aria-labelledby="auth-title">
      <div className={f.fields}>
        <div className={f.field}>
          <label htmlFor="email" className={f.label}>E-mail</label>
          <div className={f.input}><MailIcon /><input id="email" type="email" placeholder="voce@seunegocio.com.br" value={email} autoComplete="email" onChange={event => setEmail(event.target.value)} required /></div>
        </div>
        <div className={f.field}>
          <label htmlFor="password" className={f.label}>Senha</label>
          <div className={f.input}>
            <Lock aria-hidden="true" />
            <input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Esconder senha" : "Mostrar senha"} className={f.visibility}>{showPassword ? <EyeOff /> : <Eye />}</button>
          </div>
        </div>
      </div>
      <label className={f.remember}><input type="checkbox" className={f.checkbox} checked={remember} onChange={event => setRemember(event.target.checked)} />Manter conectado por 30 dias</label>
      {error && <div role="alert" className={f.error}>{error}</div>}
      <button type="submit" disabled={loading} className={f.submit}>{loading ? loadingLabel : <>{submitLabel}<ArrowRight aria-hidden="true" /></>}</button>
      <p className={f.legal}>Ao entrar, você concorda com os Termos de Uso e a Política de Privacidade do Palco.</p>
    </form>
  </PalcoAuthShell>;
}
