import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPickerField } from "@/components/wizard/color-picker-field";

describe("ColorPickerField", () => {
  it("renders the swatch with the given color and the hex label", () => {
    render(<ColorPickerField id="c1" value="#dc2626" onChange={() => {}} aria-label="Cor" />);
    const swatch = screen.getByLabelText("Cor") as HTMLInputElement;
    expect(swatch.value).toBe("#dc2626");
    expect(screen.getByText("#dc2626")).toBeInTheDocument();
  });
  it("calls onChange when the input changes", () => {
    const onChange = vi.fn();
    render(<ColorPickerField id="c2" value="#000000" onChange={onChange} aria-label="Cor" />);
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "#16a34a" } });
    expect(onChange).toHaveBeenCalledWith("#16a34a");
  });
});
