import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploadField } from "@/components/wizard/image-upload-field";

describe("ImageUploadField", () => {
  it("shows the recommended hint when no value is set", () => {
    render(
      <ImageUploadField
        webinarId="w1"
        kind="mobile"
        value={null}
        onChange={() => {}}
        recommendedHint="384×110 px"
      />
    );
    expect(screen.getByText(/384×110 px/)).toBeInTheDocument();
  });
  it("renders preview thumb + delete button when value is set", () => {
    const onChange = vi.fn();
    render(
      <ImageUploadField
        webinarId="w1"
        kind="desktop"
        value="https://cdn.example.com/x.png"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example.com/x.png");
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it("uploads via presign endpoint and calls onChange with publicUrl", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: "https://put.example/up", publicUrl: "https://cdn.example.com/desktop.png", key: "offer/w1/desktop.png" })
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ImageUploadField webinarId="w1" kind="desktop" value={null} onChange={onChange} />
    );
    const file = new File(["x"], "test.png", { type: "image/png" });
    const input = screen.getByLabelText(/imagem/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/desktop.png"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
