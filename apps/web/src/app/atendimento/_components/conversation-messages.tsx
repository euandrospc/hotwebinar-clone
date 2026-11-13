"use client";

import { Fragment } from "react";
import { MessageText } from "@/components/chat/message-text";
import { Sparkles } from "@/components/icons";
import { ATTENDANCE_TIMEZONE, attendanceToday } from "@/lib/attendance-range";
import type { PlayerLeadMsg } from "@/app/[slug]/_lib/public-types";

interface ConversationMessagesProps {
  messages: PlayerLeadMsg[];
  leadName: string;
}

const messageTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit", minute: "2-digit", timeZone: ATTENDANCE_TIMEZONE,
});
const messageDay = new Intl.DateTimeFormat("pt-BR", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: ATTENDANCE_TIMEZONE,
});
const shortDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: ATTENDANCE_TIMEZONE });

const AI_PREFIX = "IA · ";

function teamAuthor(message: PlayerLeadMsg) {
  return message.teamName?.trim() || "Equipe";
}

function dayLabel(date: Date) {
  const day = attendanceToday(date);
  const today = attendanceToday();
  const yesterday = attendanceToday(new Date(Date.now() - 86_400_000));
  if (day === today) return "Hoje";
  if (day === yesterday) return "Ontem";
  return shortDay.format(date).replace(/\.$/, "").replace(" de ", " ");
}

export function ConversationMessages({ messages, leadName }: ConversationMessagesProps) {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const date = new Date(message.createdAt);
    const day = messageDay.format(date);
    const time = messageTime.format(date);
    const newDay = !previous || messageDay.format(new Date(previous.createdAt)) !== day;
    const startsGroup = newDay
      || previous.sender !== message.sender
      || (message.sender === "team" && teamAuthor(previous) !== teamAuthor(message));
    const author = teamAuthor(message);
    const isAi = message.sender === "team" && author.startsWith(AI_PREFIX);
    const label = message.sender === "lead" ? leadName : isAi ? author.slice(AI_PREFIX.length) : author;
    const fromLead = message.sender === "lead";

    return (
      <Fragment key={message.id}>
        {newDay && <p className="flex justify-center pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.11em] text-[#6E776F] first:pt-0">
          {dayLabel(date)} · {time}
        </p>}
        <div data-message-sender={message.sender} data-message-group-start={startsGroup} role="group"
          aria-label={`Mensagem de ${label}, ${day} às ${time}`}
          className={`flex min-w-0 ${fromLead ? "justify-start" : "justify-end"} ${startsGroup ? "mt-3.5 first:mt-0" : "mt-1.5"}`}>
          <div className={`flex w-[420px] min-w-0 max-w-[85%] flex-col gap-1.5 px-3.5 py-2.5 ${fromLead
            ? "rounded-[14px_14px_14px_4px] bg-[#151915]"
            : "rounded-[14px_14px_4px_14px] border border-palco/20 bg-palco/[0.07]"}`}>
            <div className="flex items-center gap-1.5 text-[11px] leading-4">
              {startsGroup && <>
                {isAi && <Sparkles aria-hidden="true" className="h-3 w-3 text-palco" />}
                <span className={`min-w-0 truncate font-bold ${fromLead ? "text-neutral-400" : "text-palco"}`}>{label}</span>
              </>}
              <time dateTime={message.createdAt} title={`${day}, ${time} · Brasília`} className="shrink-0 tabular-nums text-[#6E776F]">{time}</time>
            </div>
            <div className="min-w-0 text-sm leading-[1.45] text-neutral-100 [&_p]:[overflow-wrap:anywhere]"><MessageText text={message.text} /></div>
          </div>
        </div>
      </Fragment>
    );
  });
}
