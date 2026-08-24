"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg } from "../_lib/public-types";

interface LeadChatInputProps {
  initial: PlayerLeadMsg[];
  currentTimeSec: number;
}

export function LeadChatInput({ initial, currentTimeSec }: LeadChatInputProps) {
  const [messages, setMessages] = useState<PlayerLeadMsg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic: PlayerLeadMsg = {
      id: "tmp-" + Date.now(),
      text: trimmed,
      sender: "lead",
      videoSec: Math.round(currentTimeSec),
      createdAt: new Date().toISOString()
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    try {
      const res = await fetch("/api/lead-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed, videoSec: Math.round(currentTimeSec) })
      });
      if (res.ok) {
        const created = (await res.json()) as PlayerLeadMsg;
        setMessages((m) => m.map((x) => (x.id === optimistic.id ? created : x)));
      } else {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {messages.map((m) => (
          <div key={m.id} className="text-sm text-right">
            <span className="rounded-md bg-primary/10 px-2 py-1">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          maxLength={500}
        />
        <Button type="submit" disabled={sending || text.trim().length === 0}>Enviar</Button>
      </form>
    </div>
  );
}
