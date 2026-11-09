import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Step1Form } from "@/components/wizard/step-1-form";
import { SalesWebhookCard } from "@/components/sales-webhook-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/actions/webinar", () => ({ updateWebinarStep1: vi.fn() }));
vi.mock("@/server/actions/settings", () => ({ regenerateWebinarSalesWebhookSecret: vi.fn() }));

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
});

async function hydrate(element: React.ReactElement, relativeUrl: string) {
  const html = renderToString(element);
  expect(html).toContain(relativeUrl);
  expect(html).not.toContain(window.location.origin);
  container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const onRecoverableError = vi.fn();
  await act(async () => { root = hydrateRoot(container!, element, { onRecoverableError }); });
  expect(onRecoverableError).not.toHaveBeenCalled();
  return container;
}

describe("webinar URL hydration", () => {
  it("hydrates the slug preview before adding the browser origin", async () => {
    const node = await hydrate(<Step1Form webinarId="webinar" initial={{ name: "Interno", title: "Aula", slug: "minha-aula", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true }} />, "minha-aula");
    expect(node.textContent).toContain(`${window.location.origin}/minha-aula`);
  });

  it("hydrates webhook URL and payload with the same origin", async () => {
    const node = await hydrate(<SalesWebhookCard webinarId="webinar" initialSecret={null} />, "/api/webhooks/sale/webinar");
    expect(node.textContent).toContain(`${window.location.origin}/api/webhooks/sale/webinar`);
  });
});
