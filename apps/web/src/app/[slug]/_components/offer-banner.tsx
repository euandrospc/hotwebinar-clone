"use client";
import { useEffect, useRef } from "react";
import type { PlayerOffer } from "../_lib/public-types";
import type { PublicLeadWithUtms } from "@/lib/public-dto";

interface Props {
  offer: PlayerOffer;
  lead: PublicLeadWithUtms;
  currentTimeSec: number;
}

function isActive(o: PlayerOffer, t: number): boolean {
  if (o.disabled) return false;
  if (o.showAtSec != null && t < o.showAtSec) return false;
  if (o.hideAtSec != null && t >= o.hideAtSec) return false;
  return true;
}

function buildUrl(link: string, lead: PublicLeadWithUtms, passUtms: boolean): string {
  if (!passUtms) return link;
  const url = new URL(link);
  const map: Array<[string, string | null]> = [
    ["utm_source", lead.utmSource],
    ["utm_medium", lead.utmMedium],
    ["utm_campaign", lead.utmCampaign],
    ["utm_term", lead.utmTerm],
    ["utm_content", lead.utmContent]
  ];
  for (const [k, v] of map) {
    if (v != null) url.searchParams.set(k, v);
  }
  return url.toString();
}

export function OfferBanner({ offer, lead, currentTimeSec }: Props) {
  const seenRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = isActive(offer, currentTimeSec);

  useEffect(() => {
    if (!active || seenRef.current) return;
    seenRef.current = true;
    void fetch("/api/offer-view", { method: "POST" }).catch(() => {});
    const t = setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  function onClick() {
    void fetch("/api/offer-click", { method: "POST" }).catch(() => {});
    if (!offer.link) return;
    const url = buildUrl(offer.link, lead, offer.passUtms);
    window.open(url, offer.sameWindow ? "_self" : "_blank", "noopener,noreferrer");
  }

  return (
    <div ref={rootRef} className="scroll-mt-4 space-y-3 rounded-lg border bg-card p-4 shadow">
      {offer.imageDesktopUrl ? (
        <img src={offer.imageDesktopUrl} alt="" className="hidden w-full rounded-md object-cover md:block" />
      ) : null}
      {offer.imageMobileUrl ? (
        <img src={offer.imageMobileUrl} alt="" className="block w-full rounded-md object-cover md:hidden" />
      ) : null}
      <div className="flex items-end justify-between gap-2 text-sm">
        <div>
          {offer.priceOriginal ? (
            <p className="text-muted-foreground line-through">De {offer.priceOriginal}</p>
          ) : null}
          {offer.priceFinal ? <p className="text-lg font-semibold">Por {offer.priceFinal}</p> : null}
        </div>
        {offer.raffleEnabled ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            🎉 Sorteio
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow"
        style={{ backgroundColor: offer.buttonColor }}
      >
        {offer.buttonText}
      </button>
    </div>
  );
}
