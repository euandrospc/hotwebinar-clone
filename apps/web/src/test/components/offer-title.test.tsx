import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OfferTitle } from "@/components/webinar/offer-title";
import { storedTitleFormatSchema } from "@/lib/offer-title-format";

afterEach(cleanup);
const format = {
  mode: "rich", background: "#172554",
  doc: { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Oferta " },
    { type: "text", text: "especial", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#ef4444", fontSize: "28px" } }] }
  ] }] }
};
it("renders formatting on selected words only", () => {
  const { container } = render(<OfferTitle title="Oferta especial" variant={JSON.stringify(format)} />);
  expect(container.querySelector("span[style]")).toHaveStyle({ color: "#ef4444", fontSize: "28px" });
  expect(container.querySelector("strong")).toHaveTextContent("especial");
  expect(screen.getByText("Oferta", { exact: true }).querySelector("strong")).toBeNull();
});
it("shows plain text when formatting is disabled", () => {
  const { container } = render(<OfferTitle title="Oferta especial" variant={JSON.stringify({ ...format, mode: "plain" })} />);
  expect(container.querySelector("strong")).toBeNull();
  expect(screen.getByRole("heading")).toHaveTextContent("Oferta especial");
});
it("rejects unsafe or unsupported stored attributes", () => {
  expect(storedTitleFormatSchema.safeParse(JSON.stringify(format)).success).toBe(true);
  const invalid = JSON.parse(JSON.stringify(format));
  invalid.doc.content[0].content[1].marks[1].attrs.color = "url(javascript:alert(1))";
  expect(storedTitleFormatSchema.safeParse(JSON.stringify(invalid)).success).toBe(false);
});
