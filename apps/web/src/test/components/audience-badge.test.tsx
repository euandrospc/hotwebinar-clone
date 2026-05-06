import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef } from "react";
import { AudienceBadge } from "@/app/[slug]/_components/audience-badge";

function Harness({
  initialT,
  mode,
  showLiveBadge = true,
}: {
  initialT: number;
  mode: "NONE" | "FIXED" | "DYNAMIC";
  showLiveBadge?: boolean;
}) {
  const ref = useRef(initialT);
  return (
    <AudienceBadge
      mode={mode}
      min={100}
      max={200}
      showLiveBadge={showLiveBadge}
      seed="webinar-1:lead-1"
      durationSec={3600}
      currentTimeRef={ref}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("AudienceBadge", () => {
  it("renders nothing when mode=NONE", () => {
    const { container } = render(<Harness initialT={0} mode="NONE" />);
    expect(container.firstChild).toBeNull();
  });
  it("renders count + live label for DYNAMIC + showLiveBadge=true", () => {
    render(<Harness initialT={1800} mode="DYNAMIC" showLiveBadge={true} />);
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
    expect(screen.getByText(/assistindo/i)).toBeInTheDocument();
  });
  it("hides live label when showLiveBadge=false", () => {
    render(<Harness initialT={1800} mode="DYNAMIC" showLiveBadge={false} />);
    expect(screen.queryByText(/AO VIVO/i)).toBeNull();
    expect(screen.getByText(/assistindo/i)).toBeInTheDocument();
  });
  it("FIXED mode renders constant count", () => {
    render(<Harness initialT={0} mode="FIXED" />);
    const initial = screen.getByText(/assistindo/i).textContent;
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText(/assistindo/i).textContent).toBe(initial);
  });
});
