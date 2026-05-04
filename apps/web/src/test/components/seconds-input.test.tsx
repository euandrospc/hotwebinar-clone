import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SecondsInput } from "@/components/ui/seconds-input";

describe("SecondsInput", () => {
  it("renders mm:ss when value is set", () => {
    function FixedWrapper() {
      const [v, setV] = useState<number | undefined>(125);
      return <SecondsInput value={v} onChange={setV} aria-label="Tempo" />;
    }
    render(<FixedWrapper />);
    const input = screen.getByLabelText("Tempo") as HTMLInputElement;
    expect(input.value).toBe("02:05");
  });

  it("parses mm:ss back to seconds on change", async () => {
    const user = userEvent.setup();
    let captured: number | undefined;
    function Capture() {
      const [v, setV] = useState<number | undefined>(0);
      return (
        <SecondsInput
          value={v}
          onChange={(n) => {
            captured = n;
            setV(n);
          }}
          aria-label="Tempo"
        />
      );
    }
    render(<Capture />);
    const input = screen.getByLabelText("Tempo");
    await user.clear(input);
    await user.type(input, "01:30");
    await user.tab();
    expect(captured).toBe(90);
  });

  it("rejects non-numeric input by clamping to 0", async () => {
    const user = userEvent.setup();
    let captured: number | undefined;
    function Capture() {
      const [v, setV] = useState<number | undefined>(60);
      return (
        <SecondsInput
          value={v}
          onChange={(n) => {
            captured = n;
            setV(n);
          }}
          aria-label="Tempo"
        />
      );
    }
    render(<Capture />);
    const input = screen.getByLabelText("Tempo");
    await user.clear(input);
    await user.type(input, "abc");
    await user.tab();
    expect(captured).toBe(0);
  });
});
