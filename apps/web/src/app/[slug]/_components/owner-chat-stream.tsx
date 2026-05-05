"use client";
import { useEffect, useRef, useState } from "react";
import type { PlayerOwnerMsg } from "../_lib/public-types";

interface OwnerChatStreamProps {
  messages: PlayerOwnerMsg[];
  currentTimeSec: number;
  leadName: string;
}

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function OwnerChatStream({ messages, currentTimeSec, leadName }: OwnerChatStreamProps) {
  const [shown, setShown] = useState<PlayerOwnerMsg[]>(() =>
    messages.filter((m) => m.showAtSec <= currentTimeSec)
  );
  const lastTimeRef = useRef<number>(currentTimeSec);

  useEffect(() => {
    const t = currentTimeSec;
    const prev = lastTimeRef.current;
    lastTimeRef.current = t;
    const newly = messages.filter((m) => m.showAtSec > prev && m.showAtSec <= t);
    if (newly.length === 0) return;
    setShown((s) => {
      const ids = new Set(s.map((m) => m.id));
      return [...s, ...newly.filter((m) => !ids.has(m.id))];
    });
  }, [currentTimeSec, messages]);

  return (
    <div className="flex flex-col gap-2">
      {shown.map((m) => (
        <div key={m.id} className="text-sm">
          <span className={m.isOwner ? "font-semibold text-primary" : "font-semibold"}>{m.authorName}: </span>
          <span>{personalize(m.text, leadName)}</span>
        </div>
      ))}
    </div>
  );
}
