import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationMessages } from "@/app/atendimento/_components/conversation-messages";
import type { PlayerLeadMsg } from "@/app/[slug]/_lib/public-types";

vi.mock("@/components/chat/message-text", () => ({ MessageText: ({ text }: { text: string }) => <p>{text}</p> }));
afterEach(cleanup);

function message(id: string, sender: "lead" | "team", createdAt: string, teamName?: string): PlayerLeadMsg {
  return { id, sender, createdAt, teamName, text: `Texto ${id}`, videoSec: null };
}

describe("compact attendance messages", () => {
  it("groups consecutive messages while keeping every message's author and Brasília time accessible", () => {
    const messages = [
      message("1", "lead", "2026-11-07T20:00:00Z"),
      message("2", "lead", "2026-11-07T22:39:00Z"),
      message("3", "team", "2026-11-07T22:40:00Z", "Maria"),
      message("4", "team", "2026-11-07T22:41:00Z", "Maria"),
      message("5", "lead", "2026-11-07T22:42:00Z"),
    ];
    const { container } = render(<ConversationMessages messages={messages} leadName="Ana" />);
    expect(screen.getAllByText("Ana")).toHaveLength(2);
    expect(screen.getAllByText("Maria")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Mensagem de Ana, 07/11/2026 às 19:39" })).toHaveAttribute("data-message-sender", "lead");
    expect(screen.getByRole("group", { name: "Mensagem de Maria, 07/11/2026 às 19:41" })).toHaveAttribute("data-message-sender", "team");
    expect(container.querySelectorAll("time")).toHaveLength(5);
    expect(container.querySelectorAll('[data-message-group-start="true"]')).toHaveLength(3);
  });

  it("labels AI replies with the agent name", () => {
    render(<ConversationMessages messages={[message("1", "team", "2026-11-07T22:40:00Z", "IA · Sofia")]} leadName="Ana" />);
    expect(screen.getByRole("group", { name: "Mensagem de Sofia, 07/11/2026 às 19:40" })).toBeInTheDocument();
  });

  it("starts a new group when the teammate or Brasília day changes", () => {
    const messages = [
      message("1", "team", "2026-11-08T01:00:00Z", "Maria"),
      message("2", "team", "2026-11-08T01:02:00Z", "João"),
      message("3", "team", "2026-11-08T02:59:00Z", "João"),
      message("4", "team", "2026-11-08T03:00:00Z", "João"),
      message("5", "team", "2026-11-08T03:01:00Z"),
      message("6", "team", "2026-11-08T03:02:00Z", "Equipe"),
    ];
    const { container } = render(<ConversationMessages messages={messages} leadName="Ana" />);
    expect(screen.getAllByText("João")).toHaveLength(2);
    expect(screen.getAllByText("Equipe")).toHaveLength(1);
    expect(container.querySelectorAll('[data-message-group-start="true"]')).toHaveLength(4);
    expect(screen.getByRole("group", { name: "Mensagem de João, 08/11/2026 às 00:00" })).toBeInTheDocument();
  });
});
