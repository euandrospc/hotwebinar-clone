import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PlayerShell } from "@/app/[slug]/_components/player-shell";
import type { PlayerShellProps } from "@/app/[slug]/_lib/public-types";

const playback = vi.hoisted(() => ({ onTimeUpdate: (_seconds: number) => {} }));

vi.mock("@/app/[slug]/_components/hls-player", () => ({
  HlsPlayer: ({ onTimeUpdate }: { onTimeUpdate: (seconds: number) => void }) => {
    playback.onTimeUpdate = onTimeUpdate;
    return <div role="region" aria-label="Vídeo do webinar" />;
  }
}));
vi.mock("@/app/[slug]/_components/tracker", () => ({ Tracker: () => null }));
vi.mock("@/lib/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: () => ({ status: "connected", emitPresence: () => {} })
}));

const props: PlayerShellProps = {
  webinar: {
    id: "w1", slug: "webinar", title: "Webinar", name: "Webinar", mode: "UNICO",
    startDate: new Date("2026-10-30T23:00:00Z"), endDate: new Date("2026-10-31T01:00:00Z"),
    timezone: "America/Sao_Paulo", waitingTitle: "Sala", waitingSubtitle: "", waitingShowThumb: false,
    logoUrl: "https://example.invalid/logo.png", primaryColor: null,
    loginButtonText: "Entrar", loginButtonColor: "#dc2626",
    nameEnabled: true, nameRequired: true, namePlaceholder: "Nome",
    emailEnabled: true, emailRequired: true, emailPlaceholder: "Email",
    phoneEnabled: false, phoneRequired: false, phonePlaceholder: "Telefone",
    pitchAtSec: 100, waitingTemplate: "DEFAULT", closedGroupUrl: null,
    loginLogoAlign: "CENTER", progressEnabled: false, progressStartPct: 0,
    progressBarColor: "#dc2626", progressTextColor: "#ffffff", progressText: "",
    formFieldOrder: ["name", "email"], audienceMode: "NONE", audienceMin: 0, audienceMax: 0,
    audienceLiveBadge: false, offerName: "Curso", offerTitle: "Curso",
    offerPriceOriginal: null, offerPriceFinal: null, offerButtonText: "Comprar", offerButtonColor: "#dc2626",
    offerImageDesktopUrl: null, offerImageMobileUrl: null, offerShowAtSec: 100, offerHideAtSec: null,
    offerLink: null, offerPassUtms: false, offerDisabled: true, offerSameWindow: false, offerRaffleEnabled: false
  },
  video: { hlsUrl: "/api/hls/v1/master.m3u8", durationSec: 7200, thumbUrl: null, customThumbUrl: null },
  offer: {
    name: "Curso", title: "Curso", priceOriginal: null, priceFinal: null,
    buttonText: "Comprar", buttonColor: "#dc2626", imageDesktopUrl: null, imageMobileUrl: null,
    showAtSec: 100, hideAtSec: null, link: null, passUtms: false, disabled: true,
    sameWindow: false, raffleEnabled: false
  },
  ownerChat: [{ id: "m1", authorName: "Equipe", text: "Bem-vindo ao chat", showAtSec: 0, isOwner: true }],
  leadChat: [],
  lead: {
    id: "l1", name: "Visitante", sessionStart: "2026-10-30T23:00:00Z",
    utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null
  },
  salesNotifications: [
    { id: "s1", showAtSec: 5, buyerName: "Ana", productName: "Curso", price: null },
    { id: "s2", showAtSec: 12, buyerName: "Bruno", productName: "Curso", price: null }
  ],
  initialOffsetSec: 0,
  teamChatName: "Suporte"
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [] }) }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function playTo(seconds: number) {
  act(() => playback.onTimeUpdate(seconds));
  act(() => vi.advanceTimersByTime(1000));
}

describe("PlayerShell chat purchases", () => {
  it("shows a scheduled purchase inside the chat while keeping history and the message draft", () => {
    render(<PlayerShell {...props} />);
    const chat = screen.getByRole("complementary", { name: "Chat do webinar" });
    const composer = within(chat).getByPlaceholderText("Diga algo...");
    fireEvent.change(composer, { target: { value: "Minha pergunta" } });

    playTo(4);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    playTo(5);

    expect(within(chat).getByRole("status")).toHaveTextContent("Ana comprou Curso");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(chat).toContainElement(screen.getByRole("region", { name: "Notificações de compra" }));
    expect(within(chat).getByText("Bem-vindo ao chat")).toBeInTheDocument();
    expect(composer).toHaveValue("Minha pergunta");
    expect(within(chat).getByRole("button", { name: "Enviar" })).toBeEnabled();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("skips past purchases on late entry and displays the next one in the chat", () => {
    render(<PlayerShell {...props} initialOffsetSec={8} />);
    playTo(9);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    playTo(12);

    const chat = screen.getByRole("complementary", { name: "Chat do webinar" });
    expect(within(chat).getByRole("status")).toHaveTextContent("Bruno comprou Curso");
    expect(screen.queryByText("Ana comprou Curso")).not.toBeInTheDocument();
  });

  it("presents video and chat without the greeting and logo header", () => {
    render(<PlayerShell {...props} />);
    expect(screen.getByRole("region", { name: "Vídeo do webinar" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Chat do webinar" })).toBeInTheDocument();
    expect(screen.queryByText("Olá, Visitante")).not.toBeInTheDocument();
    expect(document.querySelector("header")).toBeNull();
    expect(document.querySelector('img[src="https://example.invalid/logo.png"]')).toBeNull();
  });
});
