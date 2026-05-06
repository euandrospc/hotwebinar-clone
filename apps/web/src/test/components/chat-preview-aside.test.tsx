import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPreviewAside } from "@/components/wizard/chat-preview-aside";

const ITEMS = [
  { id: "1", authorName: "Ana", text: "Hello world", showAtSec: 5, isOwner: false },
  { id: "2", authorName: "Bob", text: "Spam spam", showAtSec: 10, isOwner: false },
  { id: "3", authorName: "Carol", text: "Hi Ana!", showAtSec: 15, isOwner: false }
];

describe("ChatPreviewAside", () => {
  it("renders all rows when search is empty", () => {
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    expect(screen.getAllByDisplayValue(/^(Ana|Bob|Carol)$/)).toHaveLength(3);
  });
  it("filters rows by authorName when typing in search", () => {
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "ana" } });
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bob")).toBeNull();
  });
  it("calls onDelete with original index when trash is clicked on a filtered row", () => {
    const onDelete = vi.fn();
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={onDelete} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "carol" } });
    fireEvent.click(screen.getAllByLabelText(/Remover/i)[0]);
    expect(onDelete).toHaveBeenCalledWith(2);
  });
  it("calls onDeleteAll when 'Excluir todo' clicked", () => {
    const onDeleteAll = vi.fn();
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={onDeleteAll} />
    );
    fireEvent.click(screen.getByRole("button", { name: /excluir todo/i }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });
});
