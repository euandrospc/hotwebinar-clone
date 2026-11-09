import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AttendantsManager } from "@/app/dashboard/atendentes/_components/attendants-manager";

const actions = vi.hoisted(() => ({ create: vi.fn(), toggle: vi.fn(), remove: vi.fn() }));
vi.mock("@/server/actions/attendants", () => ({ createAttendantAction: actions.create, toggleAttendantAction: actions.toggle, deleteAttendantAction: actions.remove }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  actions.create.mockReset().mockResolvedValue({ ok: true });
  actions.toggle.mockReset().mockResolvedValue({ ok: true });
  actions.remove.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

function fillCreate() {
  fireEvent.click(screen.getByRole("button", { name: "Novo atendente" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Nome"), { target: { value: "Ana" } });
  fireEvent.change(dialog.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
  fireEvent.change(dialog.getByLabelText("Senha"), { target: { value: "SenhaForte123" } });
  return dialog;
}

describe("attendants manager v2", () => {
  it("keeps creation in a dialog and closes it only after successful creation", async () => {
    render(<AttendantsManager initial={[]} />);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    fireEvent.click(fillCreate().getByRole("button", { name: "Criar atendente" }));
    await waitFor(() => expect(actions.create).toHaveBeenCalledWith({ name: "Ana", email: "ana@example.com", password: "SenhaForte123" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo atendente" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("preserves the filled form when creation fails", async () => {
    actions.create.mockResolvedValue({ error: "email_in_use" });
    render(<AttendantsManager initial={[]} />);
    fireEvent.click(fillCreate().getByRole("button", { name: "Criar atendente" }));
    await waitFor(() => expect(actions.create).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
  });

  it("preserves toggle and explicit delete confirmation in the compact table", async () => {
    render(<AttendantsManager initial={[{ id: "ana", name: "Ana", email: "ana@example.com", role: "attendant", createdAt: "2026-11-01T00:00:00Z" }]} />);
    fireEvent.click(screen.getByRole("switch", { name: "Ativar ou desativar Ana" }));
    await waitFor(() => expect(actions.toggle).toHaveBeenCalledWith("ana", true));
    expect(await screen.findByText("Desativado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir atendente" }));
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith("ana"));
    await waitFor(() => expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument());
  });
});
