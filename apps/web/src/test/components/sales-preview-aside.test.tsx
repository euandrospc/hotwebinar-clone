import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SalesPreviewAside } from "@/components/wizard/sales-preview-aside";

const ITEMS = [
  { id: "1", buyerName: "Ana", productName: "Curso A", showAtSec: 5, price: "R$ 297" },
  { id: "2", buyerName: "Bob", productName: "Mentoria", showAtSec: 10, price: null },
  { id: "3", buyerName: "Carol", productName: "Combo Ana", showAtSec: 15, price: "12x" }
];

describe("SalesPreviewAside", () => {
  it("filters by buyerName + productName (matches 'ana' in either field)", () => {
    render(
      <SalesPreviewAside webinarId="w1" slug="demo" notifications={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "ana" } });
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Combo Ana")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bob")).toBeNull();
  });
  it("calls onDelete with original index", () => {
    const onDelete = vi.fn();
    render(
      <SalesPreviewAside webinarId="w1" slug="demo" notifications={ITEMS} onUpdate={() => {}} onDelete={onDelete} onDeleteAll={() => {}} />
    );
    fireEvent.click(screen.getAllByLabelText(/Remover/i)[1]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
