"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Pencil, Plus, Trash2, X, Zap } from "@/components/icons";

export interface QuickReply {
  id: string;
  title: string;
  text: string;
}

export interface QuickRepliesHandle {
  /** Lets the composer hand arrow/enter/escape keys to the open list. Returns true when handled. */
  handleKey: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

interface QuickRepliesProps {
  draft: string;
  onInsert: (text: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}

const LIST_ID = "quick-replies-list";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50";
const field = "w-full rounded-lg border border-[#1E241F] bg-[#070807] px-2.5 text-[13px] text-neutral-100 placeholder:text-[#6E776F] focus:border-palco/40 focus:outline-none";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/** "/" at the start of an otherwise single-word draft opens the list filtered by that word. */
export function slashQuery(draft: string) {
  return /^\/(\S*)$/.exec(draft)?.[1] ?? null;
}

export const QuickReplies = forwardRef<QuickRepliesHandle, QuickRepliesProps>(function QuickReplies({ draft, onInsert, composerRef }, ref) {
  const [replies, setReplies] = useState<QuickReply[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<QuickReply | "new" | null>(null);
  const [form, setForm] = useState({ title: "", text: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const query = slashQuery(draft);
  const open = manualOpen || (query !== null && dismissedDraft !== draft);
  const needle = normalize(query ?? "");
  const items = (replies ?? []).filter(reply => !needle || normalize(`${reply.title} ${reply.text}`).includes(needle));
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/attendant/quick-replies", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error();
      setReplies((await res.json() as { replies: QuickReply[] }).replies);
    } catch { setLoadError(true); }
  }, []);

  useEffect(() => { if (open && replies === null && !loadError) void load(); }, [open, replies, loadError, load]);
  useEffect(() => { setActive(0); }, [needle]);

  // The composer keeps focus while browsing, so expose the list state on it for screen readers.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setAttribute("aria-expanded", String(open && !editing));
    if (open && !editing && items[activeIndex]) composer.setAttribute("aria-activedescendant", `quick-reply-${items[activeIndex].id}`);
    else composer.removeAttribute("aria-activedescendant");
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || composerRef.current?.parentElement?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  });

  function close() {
    setManualOpen(false);
    setDismissedDraft(draft);
    setEditing(null);
    setConfirmDelete(null);
  }

  function insert(reply: QuickReply) {
    const base = query !== null ? "" : draft.trimEnd();
    onInsert((base ? `${base} ${reply.text}` : reply.text).slice(0, 500));
    setManualOpen(false);
    setDismissedDraft(null);
    composerRef.current?.focus();
  }

  useImperativeHandle(ref, () => ({
    handleKey(event) {
      if (!open || editing) return false;
      if (event.key === "Escape") { close(); return true; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!items.length) return true;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + step + items.length) % items.length);
        return true;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        if (items[activeIndex]) { insert(items[activeIndex]); return true; }
        // A bare "/word" with no match is a lookup, not a message: never send it by accident.
        return event.key === "Enter" && query !== null;
      }
      return false;
    }
  }));

  function startEdit(target: QuickReply | "new") {
    setEditing(target);
    setForm(target === "new" ? { title: query ?? "", text: "" } : { title: target.title, text: target.text });
    setFormError("");
    setConfirmDelete(null);
  }

  async function save() {
    const title = form.title.trim().replace(/^\//, "");
    const text = form.text.trim();
    if (!title || !text || saving) { setFormError("Preencha o atalho e a mensagem."); return; }
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/attendant/quick-replies", {
        method: editing === "new" ? "POST" : "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(editing && editing !== "new" ? { id: editing.id } : {}), title, text })
      });
      if (res.status === 409) { setFormError("Já existe uma resposta com esse atalho."); return; }
      if (!res.ok) throw new Error();
      const saved = await res.json() as QuickReply;
      setReplies(previous => [...(previous ?? []).filter(reply => reply.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")));
      setEditing(null);
    } catch { setFormError("Não foi possível salvar. Tente novamente."); }
    finally { setSaving(false); }
  }

  async function remove(reply: QuickReply) {
    try {
      const res = await fetch(`/api/attendant/quick-replies?${new URLSearchParams({ id: reply.id })}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setReplies(previous => (previous ?? []).filter(item => item.id !== reply.id));
      setConfirmDelete(null);
    } catch { setFormError("Não foi possível excluir. Tente novamente."); }
  }

  return <>
    <button type="button" onClick={() => { if (open) close(); else { setManualOpen(true); setDismissedDraft(null); } }}
      aria-label="Respostas rápidas" title="Respostas rápidas (/)" aria-haspopup="listbox" aria-expanded={open}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-[#121512] hover:text-neutral-100 ${open ? "text-palco" : "text-[#6E776F]"} ${focusRing}`}>
      <Zap aria-hidden="true" className="h-4 w-4" />
    </button>
    {open && <div ref={panelRef} className="absolute inset-x-0 bottom-full z-20 mb-2 flex max-h-80 flex-col overflow-hidden rounded-xl border border-[#1E241F] bg-[#0C0E0C] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1A1F1B] px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#6E776F]">Respostas rápidas</p>
        <div className="flex items-center gap-1">
          {!editing && <button type="button" onClick={() => startEdit("new")} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-palco hover:bg-palco/10 ${focusRing}`}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />Nova
          </button>}
          <button type="button" onClick={close} aria-label="Fechar respostas rápidas" className={`grid h-6 w-6 place-items-center rounded-md text-[#7C867E] hover:bg-[#121512] hover:text-neutral-100 ${focusRing}`}><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Not a <form>: this panel lives inside the composer form. */}
      {editing ? <div role="group" aria-label={editing === "new" ? "Nova resposta rápida" : "Editar resposta rápida"} className="flex flex-col gap-2 p-3">
        <label className="flex flex-col gap-1 text-[11px] text-neutral-400">Atalho
          <span className="flex items-center rounded-lg border border-[#1E241F] bg-[#070807] pl-2.5 focus-within:border-palco/40">
            <span aria-hidden="true" className="text-[13px] text-[#6E776F]">/</span>
            <input autoFocus value={form.title} maxLength={40} onChange={event => setForm(value => ({ ...value, title: event.target.value.replace(/\s+/g, "-") }))}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape") { event.preventDefault(); setEditing(null); } }}
              placeholder="replay" className="h-8 min-w-0 flex-1 bg-transparent pl-0.5 pr-2.5 text-[13px] text-neutral-100 placeholder:text-[#6E776F] focus:outline-none" />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-400">Mensagem
          <textarea value={form.text} maxLength={500} rows={3} onChange={event => setForm(value => ({ ...value, text: event.target.value }))}
            onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setEditing(null); } }}
            placeholder="O replay fica disponível por 7 dias no mesmo link." className={`${field} resize-none py-2 leading-[1.45]`} />
        </label>
        {formError && <p role="alert" className="text-xs text-red-400">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className={`rounded-lg border border-[#1E241F] px-3 py-1.5 text-xs font-semibold text-[#C9D1CA] hover:bg-[#121512] ${focusRing}`}>Cancelar</button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`rounded-lg bg-palco px-3 py-1.5 text-xs font-semibold text-palco-ink disabled:opacity-50 ${focusRing}`}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div> : <div className="min-h-0 overflow-y-auto p-1.5">
        {loadError ? <div className="flex items-center justify-between gap-2 px-2 py-3 text-[13px] text-red-400">
          Não foi possível carregar as respostas rápidas.
          <button type="button" onClick={() => void load()} className={`shrink-0 text-xs font-semibold text-palco hover:underline ${focusRing}`}>Tentar novamente</button>
        </div>
          : replies === null ? <p className="px-2 py-3 text-[13px] text-[#7C867E]">Carregando…</p>
            : !items.length ? <p className="px-2 py-3 text-[13px] text-[#7C867E]">{replies.length ? "Nenhuma resposta com esse atalho." : "Nenhuma resposta salva. Crie a primeira em “Nova”."}</p>
              : <ul id={LIST_ID} role="listbox" aria-label="Respostas rápidas" className="flex flex-col gap-0.5">
                {items.map((reply, index) => (
                  <li key={reply.id} id={`quick-reply-${reply.id}`} role="option" aria-selected={index === activeIndex}
                    onPointerMove={() => setActive(index)}
                    className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 ${index === activeIndex ? "bg-[#151915]" : ""}`}>
                    <button type="button" tabIndex={-1} onClick={() => insert(reply)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left focus:outline-none">
                      <span className="text-xs font-bold text-palco">/{reply.title}</span>
                      <span className="line-clamp-2 text-[13px] leading-[1.4] text-[#C9D1CA] [overflow-wrap:anywhere]">{reply.text}</span>
                    </button>
                    {confirmDelete === reply.id
                      ? <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => void remove(reply)} className={`rounded-md px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-400/10 ${focusRing}`}>Excluir</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className={`rounded-md px-2 py-1 text-xs text-[#7C867E] hover:bg-[#121512] ${focusRing}`}>Cancelar</button>
                      </span>
                      : <span className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100 sm:group-aria-selected:opacity-100">
                        <button type="button" onClick={() => startEdit(reply)} aria-label={`Editar /${reply.title}`} className={`grid h-7 w-7 place-items-center rounded-md text-[#7C867E] hover:bg-[#1A1F1B] hover:text-neutral-100 ${focusRing}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => setConfirmDelete(reply.id)} aria-label={`Excluir /${reply.title}`} className={`grid h-7 w-7 place-items-center rounded-md text-[#7C867E] hover:bg-[#1A1F1B] hover:text-red-400 ${focusRing}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>}
                  </li>
                ))}
              </ul>}
        {formError && <p role="alert" className="px-2 py-1 text-xs text-red-400">{formError}</p>}
      </div>}
      {!editing && <p className="border-t border-[#1A1F1B] px-3 py-1.5 text-[11px] text-[#6E776F]">↑↓ para navegar · Enter para inserir · Esc para fechar</p>}
    </div>}
  </>;
});
