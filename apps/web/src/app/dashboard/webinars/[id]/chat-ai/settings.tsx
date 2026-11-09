"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/admin-page";
import styles from "@/components/webinar/webinar-operations.module.css";
type Config = { enabled: boolean; name: string; model: string; instructions: string; providerReady: boolean };
export function ChatAiSettings({ webinarId }: { webinarId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/webinars/${webinarId}/chat-ai`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); setConfig(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setMessage("Não foi possível carregar a configuração."); });
    return () => controller.abort();
  }, [webinarId]);
  if (!config) return <p role="status" className="rounded-xl border bg-card p-5 text-xs text-muted-foreground">{message || "Carregando agente…"}</p>;
  function patch(data: Partial<Config>) { setConfig(current => current ? { ...current, ...data } : current); }
  return <><AdminPageHeader title="Agente de atendimento" description="Configure a identidade, o modelo e as respostas automáticas deste webinar." /><form className={`${styles.surface} ${styles.form}`} onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/webinars/${webinarId}/chat-ai`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
      const result = await response.json();
      setMessage(response.ok ? "Agente salvo." : result.error || "Não foi possível salvar.");
    } catch { setMessage("Não foi possível salvar."); } finally { setSaving(false); }
  }}>

    {!config.providerReady && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Configure OPENAI_API_KEY no ambiente do servidor para liberar a ativação. Você já pode salvar o nome, modelo e a base de respostas.</p>}
    <div className={styles.formFields}><label>Nome do agente<Input value={config.name} maxLength={60} required onChange={e => patch({ name: e.target.value })} /></label>
    <label>Modelo OpenAI<Input value={config.model} maxLength={100} required onChange={e => patch({ model: e.target.value })} /></label></div>
    <label>Instruções e base de respostas<textarea value={config.instructions} maxLength={20000} rows={10} className="block w-full rounded-lg border bg-background p-3 text-sm" placeholder="Descreva o produto, público, respostas frequentes, regras de preço e condições que o agente pode informar." onChange={e => patch({ instructions: e.target.value })} /></label>
    <label className={styles.toggleRow}><input type="checkbox" checked={config.enabled} disabled={!config.providerReady} onChange={e => patch({ enabled: e.target.checked })} />Ativar respostas automáticas neste webinar</label>
    <div className={styles.formFooter}><p className={styles.caption}>O atendente pode assumir a conversa e pausar a IA a qualquer momento.</p><Button disabled={saving}>{saving ? "Salvando…" : "Salvar agente"}</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form></>;
}
