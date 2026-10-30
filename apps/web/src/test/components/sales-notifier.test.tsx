import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, within } from "@testing-library/react";
import { StrictMode, useRef } from "react";
import { SalesNotifier } from "@/app/[slug]/_components/sales-notifier";
import type { PublicSaleNotification } from "@/lib/public-dto";

const NOTIFS: PublicSaleNotification[] = [
  { id: "1", showAtSec: 5, buyerName: "Ana", productName: "Curso A", price: "R$ 99" },
  { id: "2", showAtSec: 10, buyerName: "Bob", productName: "Mentor", price: null }
];

const clock = { ref: null as { current: number } | null };

function Harness({ initialT = 0, notifs = NOTIFS }: { initialT?: number; notifs?: PublicSaleNotification[] }) {
  const ref = useRef(initialT);
  clock.ref = ref;
  return <section aria-label="Chat"><SalesNotifier notifications={notifs} currentTimeRef={ref} /></section>;
}

function playTo(t: number) {
  clock.ref!.current = t;
  act(() => { vi.advanceTimersByTime(1000); });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("SalesNotifier", () => {
  it("does not show a purchase before its scheduled video time", () => {
    render(<Harness />);
    playTo(4.99);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notificações de compra" })).not.toBeInTheDocument();
  });

  it("shows the scheduled purchase inside the chat rather than a global toast", () => {
    const { container } = render(<Harness />);
    playTo(5);
    const chat = screen.getByRole("region", { name: "Chat" });
    expect(within(chat).getByRole("status")).toHaveTextContent("Ana comprou Curso A por R$ 99");
    expect(container.querySelector("[data-sonner-toast]")).toBeNull();
    expect(document.querySelectorAll('[data-sale-notification="1"]')).toHaveLength(1);
  });

  it("keeps each message visible for six seconds and then removes it after the exit", () => {
    render(<Harness />);
    playTo(5);
    act(() => { vi.advanceTimersByTime(5999); });
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "open");
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "closed");
    act(() => { vi.advanceTimersByTime(180); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notificações de compra" })).not.toBeInTheDocument();
  });

  it("does not repeat an expired purchase when the video moves backwards and forwards", () => {
    render(<Harness />);
    playTo(5);
    act(() => { vi.advanceTimersByTime(6000); });
    act(() => { vi.advanceTimersByTime(180); });
    playTo(3);
    playTo(6);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores earlier purchases for a late arrival but still shows upcoming purchases", () => {
    render(<Harness initialT={6} />);
    playTo(9);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    playTo(10);
    expect(screen.getByRole("status")).toHaveTextContent("Bob comprou Mentor");
    expect(screen.queryByText("Ana comprou Curso A por R$ 99")).not.toBeInTheDocument();
  });

  it("allows a notification at the exact initial offset", () => {
    render(<Harness initialT={5} />);
    playTo(5);
    expect(screen.getByRole("status")).toHaveTextContent("Ana comprou Curso A por R$ 99");
  });

  it("preserves free-form messages without adding a product or price", () => {
    render(<Harness notifs={[{ id: "free", showAtSec: 5, buyerName: "30% das vagas preenchidas!", productName: "", price: null }]} />);
    playTo(5);
    expect(screen.getByRole("status")).toHaveTextContent(/^30% das vagas preenchidas!$/);
  });

  it("keeps at most three recent purchases visible when several become due together", () => {
    const notifs = Array.from({ length: 5 }, (_, i) => ({ id: String(i), showAtSec: i + 1, buyerName: `Pessoa ${i}`, productName: "Curso", price: null }));
    render(<Harness notifs={notifs} />);
    playTo(5);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.queryByText("Pessoa 0 comprou Curso")).not.toBeInTheDocument();
    expect(screen.queryByText("Pessoa 1 comprou Curso")).not.toBeInTheDocument();
    expect(screen.getByText("Pessoa 4 comprou Curso")).toBeInTheDocument();
  });

  it("does not extend an older notification when a new one arrives", () => {
    render(<Harness />);
    playTo(5);
    act(() => { vi.advanceTimersByTime(4000); });
    playTo(10);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(180); });
    expect(screen.queryByText("Ana comprou Curso A por R$ 99")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Bob comprou Mentor");
  });

  it("cleans up pending scheduling and dismissal on unmount", () => {
    const { unmount } = render(<StrictMode><Harness /></StrictMode>);
    playTo(5);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
