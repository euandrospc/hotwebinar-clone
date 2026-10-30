import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Step2Form } from "@/components/wizard/step-2-form";
import { updateWebinarStep2 } from "@/server/actions/webinar";
import type { Step2Input } from "@/lib/validations/webinar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/actions/webinar", () => ({ updateWebinarStep2: vi.fn() }));

const initial: Step2Input = {
  mode: "UNICO", recurring: true, recurringDays: [1, 2, 3, 4, 5],
  startDate: new Date("2026-10-29T23:00:00Z"), endDate: new Date("2026-10-30T01:10:00Z"),
  timezone: "America/Sao_Paulo", waitingTitle: "Sala", waitingSubtitle: "",
  waitingTemplate: "DEFAULT", waitingShowThumb: false, closedGroupUrl: ""
};

beforeEach(() => { vi.mocked(updateWebinarStep2).mockReset().mockResolvedValue({ ok: true }); });

describe("recurring schedule editor", () => {
  it("shows an anchor date and session times, preserving the saved schedule", async () => {
    render(<Step2Form webinarId="w1" initial={initial} />);
    expect(screen.getByRole("button", { name: "Começar a partir de - data" })).toHaveTextContent("29/10/2026");
    expect(screen.getByLabelText("Horário de início")).toHaveValue("20:00");
    expect(screen.getByLabelText("Horário de finalização")).toHaveValue("22:10");
    expect(screen.queryByText("Data e hora de finalização")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await waitFor(() => expect(updateWebinarStep2).toHaveBeenCalledWith("w1", initial));
  });

  it("moves both session dates when the anchor date changes", async () => {
    render(<Step2Form webinarId="w1" initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Começar a partir de - data" }));
    const day = document.querySelector(`button[data-day="${new Date(2026, 9, 31).toLocaleDateString()}"]`);
    expect(day).not.toBeNull();
    fireEvent.click(day!);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await waitFor(() => expect(updateWebinarStep2).toHaveBeenCalledWith("w1", {
      ...initial, startDate: new Date("2026-10-31T23:00:00Z"), endDate: new Date("2026-11-01T01:10:00Z")
    }));
  });

  it("saves an overnight end time on the following day in the webinar timezone", async () => {
    render(<Step2Form webinarId="w1" initial={initial} />);
    fireEvent.change(screen.getByLabelText("Horário de finalização"), { target: { value: "01:10" } });
    expect(screen.getByText("Termina no dia seguinte.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await waitFor(() => expect(updateWebinarStep2).toHaveBeenCalledWith("w1", {
      ...initial, endDate: new Date("2026-10-30T04:10:00Z")
    }));
  });

  it("keeps the date/time fields for single events and JIT", () => {
    render(<Step2Form webinarId="w1" initial={initial} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Webinar recorrente" }));
    expect(screen.getByText("Data e hora de início")).toBeInTheDocument();
    expect(screen.getByText("Data e hora de finalização")).toBeInTheDocument();
    expect(screen.queryByText("Começar a partir de")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Just in time" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("checkbox", { name: "Webinar recorrente" })).not.toBeInTheDocument();
    expect(screen.getByText("Data e hora de finalização")).toBeInTheDocument();
  });

  it("rejects equal session times and a recurrence without selected weekdays", async () => {
    render(<Step2Form webinarId="w1" initial={{ ...initial, recurringDays: [] }} />);
    fireEvent.change(screen.getByLabelText("Horário de finalização"), { target: { value: "20:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(await screen.findByText("Fim deve ser após início")).toBeInTheDocument();
    expect(await screen.findByText("Escolha pelo menos um dia da semana")).toBeInTheDocument();
    expect(updateWebinarStep2).not.toHaveBeenCalled();
  });

  it("retains the required date when reselecting it before enabling recurrence", () => {
    render(<Step2Form webinarId="w1" initial={{ ...initial, recurring: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Início - data" }));
    fireEvent.click(document.querySelector(`button[data-day="${initial.startDate.toLocaleDateString()}"]`)!);
    fireEvent.click(screen.getByRole("checkbox", { name: "Webinar recorrente" }));
    expect(screen.getByRole("button", { name: "Começar a partir de - data" })).toHaveTextContent("29/10/2026");
    expect(screen.getByLabelText("Horário de início")).toHaveValue("20:00");
  });
});
