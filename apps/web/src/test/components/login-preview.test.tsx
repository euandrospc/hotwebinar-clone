import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginPreview } from "@/components/wizard/login-preview";

const baseProps = {
  logoUrl: "",
  loginLogoAlign: "CENTER" as const,
  title: "My Webinar",
  loginButtonText: "Entrar",
  loginButtonColor: "#16a34a",
  primaryColor: "#16a34a",
  nameEnabled: true,
  emailEnabled: true,
  phoneEnabled: false,
  namePlaceholder: "Nome",
  emailPlaceholder: "Email",
  phonePlaceholder: "Tel",
  formFieldOrder: ["name", "email", "phone"] as const,
  progressEnabled: false,
  progressStartPct: 50,
  progressBarColor: "#dc2626",
  progressTextColor: "#ffffff",
  progressText: "{pct}% das vagas..."
};

describe("LoginPreview", () => {
  it("renders title + button text", () => {
    render(<LoginPreview {...baseProps} />);
    expect(screen.getByText("My Webinar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("respects formFieldOrder excluding disabled phone", () => {
    render(<LoginPreview {...baseProps} formFieldOrder={["phone", "name", "email"]} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.some((el) => el.getAttribute("placeholder") === "Nome")).toBe(true);
    expect(screen.queryByPlaceholderText("Tel")).toBeNull();
  });

  it("shows progress text with pct substituted when enabled", () => {
    render(<LoginPreview {...baseProps} progressEnabled progressStartPct={75} progressText="{pct}% feito" />);
    expect(screen.getByText(/75% feito/)).toBeInTheDocument();
  });
});
