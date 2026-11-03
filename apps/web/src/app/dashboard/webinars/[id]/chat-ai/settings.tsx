"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  if (!config) return <p role="status" className="p-6">{message || "Carregando agente…"}</p>;
  function patch(data: Partial<Config>) { setConfig(current => current ? { ...current, ...data } : current); }
  return <form className="mt-6 max-w-3xl space-y-5 rounded-xl border bg-card p-6" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/webinars/${webinarId}/chat-ai`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
      const result = await response.json();
      setMessage(response.ok ? "Agente salvo." : result.error || "Não foi possível salvar.");
    } catch { setMessage("Não foi possível salvar."); } finally { setSaving(false); }
  }}>
    <div><h1 className="text-2xl font-semibold">Agente de atendimento</h1><p className="mt-2 text-sm text-muted-foreground">O agente usa o histórico da conversa e as informações deste webinar. O atendente pode assumir e pausar a IA a qualquer momento.</p></div>
    {!config.providerReady && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Configure OPENAI_API_KEY no ambiente do servidor para liberar a ativação. Você já pode salvar o nome, modelo e a base de respostas.</p>}
    <label className="block space-y-2 text-sm">Nome do agente<Input value={config.name} maxLength={60} required onChange={e => patch({ name: e.target.value })} /></label>
    <label className="block space-y-2 text-sm">Modelo OpenAI<Input value={config.model} maxLength={100} required onChange={e => patch({ model: e.target.value })} /></label>
    <label className="block space-y-2 text-sm">Instruções e base de respostas<textarea value={config.instructions} maxLength={20000} rows={12} className="block w-full rounded-lg border bg-background p-3 text-sm" placeholder="Descreva o produto, público, respostas frequentes, regras de preço e condições que o agente pode informar." onChange={e => patch({ instructions: e.target.value })} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.enabled} disabled={!config.providerReady} onChange={e => patch({ enabled: e.target.checked })} />Ativar respostas automáticas neste webinar</label>
    <Button disabled={saving}>{saving ? "Salvando…" : "Salvar agente"}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
