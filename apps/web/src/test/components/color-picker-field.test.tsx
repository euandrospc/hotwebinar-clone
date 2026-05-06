import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPickerField } from "@/components/wizard/color-picker-field";

describe("ColorPickerField", () => {
  it("renders the trigger with the given color and hex label", () => {
    render(<ColorPickerField id="c1" value="#dc2626" onChange={() => {}} aria-label="Cor" />);
    const trigger = screen.getByLabelText("Cor");
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("#dc2626")).toBeInTheDocument();
  });
  it("opens the popover and lets user type a hex into the input", async () => {
    const onChange = vi.fn();
    render(<ColorPickerField id="c2" value="#000000" onChange={onChange} aria-label="Cor" />);
    fireEvent.click(screen.getByLabelText("Cor"));
    const hexInput = await screen.findByLabelText("Hex");
    fireEvent.change(hexInput, { target: { value: "#16a34a" } });
    expect(onChange).toHaveBeenCalledWith("#16a34a");
  });
});
