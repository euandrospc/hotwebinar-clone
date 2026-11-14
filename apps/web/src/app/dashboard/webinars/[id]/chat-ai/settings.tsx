"use client";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page";
import { ChevronDown } from "@/components/icons";

type Config = { enabled: boolean; name: string; model: string; instructions: string; providerReady: boolean };
// Suggestions only: the API accepts any valid OpenAI model id, so the field stays free text.
const MODEL_SUGGESTIONS = ["gpt-4.1-mini", "gpt-5.4-mini"];
const field = "block w-full rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5 font-palco text-sm font-medium text-neutral-100 outline-none transition-colors placeholder:font-normal placeholder:text-[#6E776F] focus-visible:border-palco/60 focus-visible:ring-2 focus-visible:ring-palco/25 motion-reduce:transition-none";
const label = "flex flex-col gap-2 font-palco text-[13px] font-semibold text-[#C9D1CA]";

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
  const header = <AdminPageHeader title="Agente de atendimento" description="Configure a identidade, o modelo e as respostas automáticas deste webinar." />;
  if (!config) return <>{header}<p role="status" className="rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6 font-palco text-sm text-neutral-400">{message || "Carregando agente…"}</p></>;
  function patch(data: Partial<Config>) { setConfig(current => current ? { ...current, ...data } : current); }
  const models = MODEL_SUGGESTIONS.includes(config.model) ? MODEL_SUGGESTIONS : [config.model, ...MODEL_SUGGESTIONS];
  return <>{header}<form className="flex flex-col gap-5 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6 font-palco" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/webinars/${webinarId}/chat-ai`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
      const result = await response.json();
      setMessage(response.ok ? "Agente salvo." : result.error || "Não foi possível salvar.");
    } catch { setMessage("Não foi possível salvar."); } finally { setSaving(false); }
  }}>
    {!config.providerReady && <p role="status" className="rounded-[10px] border border-[#F5B742]/30 bg-[#F5B742]/10 p-3.5 text-[13px] text-[#F5B742]">Configure OPENAI_API_KEY no ambiente do servidor para liberar a ativação. Você já pode salvar o nome, modelo e a base de respostas.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>Nome do agente<input className={`${field} h-[42px]`} value={config.name} maxLength={60} required onChange={e => patch({ name: e.target.value })} /></label>
      <label className={label}>Modelo OpenAI<span className="relative">
        <input className={`${field} h-[42px] pr-10`} list="chat-ai-models" value={config.model} maxLength={100} required onChange={e => patch({ model: e.target.value })} />
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <datalist id="chat-ai-models">{models.map(model => <option key={model} value={model} />)}</datalist>
      </span></label>
    </div>
    <label className={label}>Instruções e base de respostas<textarea className={`${field} h-[220px] resize-y py-3.5 font-normal`} value={config.instructions} maxLength={20000} placeholder="Descreva o produto, público, respostas frequentes, regras de preço e condições que o agente pode informar." onChange={e => patch({ instructions: e.target.value })} /></label>
    <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] bg-[#0F130F] p-3.5 text-[13px] font-semibold text-neutral-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-neutral-400">
      <input type="checkbox" className="size-4 cursor-[inherit] rounded border-[#3A423C] accent-palco" checked={config.enabled} disabled={!config.providerReady} onChange={e => patch({ enabled: e.target.checked })} />
      Ativar respostas automáticas neste webinar
    </label>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-neutral-500">O atendente pode assumir a conversa e pausar a IA a qualquer momento.</p>
      <button disabled={saving} className="h-[38px] rounded-[10px] bg-palco px-4 text-[13px] font-semibold text-palco-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0E0C] disabled:opacity-60 motion-reduce:transition-none">{saving ? "Salvando…" : "Salvar agente"}</button>
    </div>
    {message && <p role="status" className="text-[13px] text-neutral-400">{message}</p>}
  </form></>;
}
