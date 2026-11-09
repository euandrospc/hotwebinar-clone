"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "@/components/icons";
import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import styles from "@/components/admin/admin-auth-frame.module.css";

// Retain the public component contract used by the login and 2FA flow.
export interface AnimatedCharactersLoginPageProps {
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loadingLabel?: string;
  onSubmit: (email: string, password: string) => Promise<void> | void;
  error?: string | null;
  loading?: boolean;
}

export function AnimatedCharactersLoginPage({ title = "Bem-vindo de volta", subtitle = "Entre com seus dados", submitLabel = "Entrar", loadingLabel = "Entrando...", onSubmit, error = null, loading = false }: AnimatedCharactersLoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return <AdminAuthFrame title={title} description={subtitle}>
    <form onSubmit={async event => { event.preventDefault(); await onSubmit(email, password); }} className={styles.form}>
      <div className={styles.field}>
        <Label htmlFor="email" className={styles.label}>Email</Label>
        <Input id="email" type="email" placeholder="seu@email.com" value={email} autoComplete="email" onChange={event => setEmail(event.target.value)} required className={styles.input} />
      </div>
      <div className={styles.field}>
        <Label htmlFor="password" className={styles.label}>Senha</Label>
        <div className={styles.password}>
          <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required className={styles.input} />
          <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Esconder senha" : "Mostrar senha"} className={styles.visibility}>{showPassword ? <EyeOff /> : <Eye />}</button>
        </div>
      </div>
      <div className={styles.remember}><Checkbox id="remember" /><Label htmlFor="remember">Lembrar de mim por 30 dias</Label></div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      <Button type="submit" disabled={loading} className={styles.submit}>{loading ? loadingLabel : submitLabel}</Button>
    </form>
  </AdminAuthFrame>;
}
