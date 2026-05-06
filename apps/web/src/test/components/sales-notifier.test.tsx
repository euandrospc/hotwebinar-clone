import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { SalesNotifier } from "@/app/[slug]/_components/sales-notifier";

const toastMock = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastMock(...args) } }));

const NOTIFS = [
  { id: "1", showAtSec: 5, buyerName: "Ana", productName: "Curso A", price: "R$ 99" },
  { id: "2", showAtSec: 10, buyerName: "Bob", productName: "Mentor", price: null }
];

function Harness({ initialT, notifs }: { initialT: number; notifs: typeof NOTIFS }) {
  const ref = useRef(initialT);
  return <SalesNotifier notifications={notifs} currentTimeRef={ref} />;
}

beforeEach(() => {
  toastMock.mockClear();
  vi.useFakeTimers();
});

describe("SalesNotifier", () => {
  it("does not fire before any showAtSec", () => {
    render(<Harness initialT={0} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).not.toHaveBeenCalled();
  });
  it("fires once when timeline crosses showAtSec", () => {
    render(<Harness initialT={6} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(2200); });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
  it("fires both notifs when ref is past both showAtSecs", () => {
    render(<Harness initialT={20} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).toHaveBeenCalledTimes(2);
  });
  it("formats toast text with price when set", () => {
    render(<Harness initialT={6} notifs={[NOTIFS[0]]} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock.mock.calls[0][0]).toContain("Ana");
    expect(toastMock.mock.calls[0][0]).toContain("Curso A");
    expect(toastMock.mock.calls[0][0]).toContain("R$ 99");
  });
});
