import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SecondsInput } from "@/components/ui/seconds-input";

describe("SecondsInput", () => {
  it("renders hours, minutes and seconds when value is set", () => {
    function FixedWrapper() {
      const [v, setV] = useState<number | undefined>(125);
      return <SecondsInput value={v} onChange={setV} aria-label="Tempo" />;
    }
    render(<FixedWrapper />);
    expect(screen.getByLabelText("Tempo horas")).toHaveValue("00");
    expect(screen.getByLabelText("Tempo minutos")).toHaveValue("02");
    expect(screen.getByLabelText("Tempo segundos")).toHaveValue("05");
  });

  it("combines edited minutes and seconds on blur", async () => {
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
    const input = screen.getByLabelText("Tempo minutos");
    await user.clear(input);
    await user.type(input, "01");
    await user.tab();
    const seconds = screen.getByLabelText("Tempo segundos");
    await user.clear(seconds);
    await user.type(seconds, "30");
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
    const input = screen.getByLabelText("Tempo minutos");
    await user.clear(input);
    await user.type(input, "abc");
    await user.tab();
    expect(captured).toBe(0);
  });
});
