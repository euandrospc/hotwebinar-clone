"use client";

import { MessageText } from "@/components/chat/message-text";
import { ATTENDANCE_TIMEZONE } from "@/lib/attendance-range";
import type { PlayerLeadMsg } from "@/app/[slug]/_lib/public-types";
import styles from "./conversation-messages.module.css";

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

function teamAuthor(message: PlayerLeadMsg) {
  return message.teamName?.trim() || "Equipe";
}

function senderLabel(message: PlayerLeadMsg, leadName: string) {
  if (message.sender === "lead") return `Público · ${leadName}`;
  const author = teamAuthor(message);
  return author.toLocaleLowerCase("pt-BR") === "equipe" ? "Equipe" : `Equipe · ${author}`;
}

export function ConversationMessages({ messages, leadName }: ConversationMessagesProps) {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const date = new Date(message.createdAt);
    const day = messageDay.format(date);
    const time = messageTime.format(date);
    const startsGroup = !previous
      || previous.sender !== message.sender
      || (message.sender === "team" && teamAuthor(previous) !== teamAuthor(message))
      || messageDay.format(new Date(previous.createdAt)) !== day;
    const label = senderLabel(message, leadName);

    return (
      <div key={message.id} className={styles.row} data-message-sender={message.sender}
        data-message-group-start={startsGroup} role="group" aria-label={`Mensagem de ${label}, ${day} às ${time}`}>
        {startsGroup && <p className={styles.sender}>{label}</p>}
        <div className={styles.bubble}>
          <div className={styles.content}><MessageText text={message.text} /></div>
          <time dateTime={message.createdAt} title={`${day}, ${time} · Brasília`} className={styles.time}>{time}</time>
        </div>
      </div>
    );
  });
}
