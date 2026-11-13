"use client";
import { OfferTitle } from "@/components/webinar/offer-title";

export interface OfferPreviewProps {
  offerName?: string;
  offerTitle: string;
  offerTitleStyle?: string;
  offerPriceOriginal: string | null;
  offerPriceFinal: string | null;
  offerButtonText: string;
  offerButtonColor: string;
  offerImageDesktopUrl: string | null;
  offerImageMobileUrl: string | null;
  offerRaffleEnabled: boolean;
}

export function OfferPreviewDesktop(p: OfferPreviewProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1E241F] bg-[#070807] p-4 text-neutral-100 [&_h2]:text-lg [&_h2]:font-bold">
      <OfferTitle title={p.offerTitle} variant={p.offerTitleStyle} />
      {p.offerImageDesktopUrl ? (
        <img src={p.offerImageDesktopUrl} alt="" className="w-full rounded-lg object-cover" />
      ) : null}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {p.offerPriceOriginal ? (
            <p className="text-xs text-[#7C867E]">De {p.offerPriceOriginal}</p>
          ) : null}
          {p.offerPriceFinal ? (
            <p className="text-lg font-bold leading-tight">Por {p.offerPriceFinal}</p>
          ) : null}
        </div>
        {p.offerRaffleEnabled ? (
          <span className="rounded-md bg-[#F5B742]/15 px-2 py-0.5 text-[11px] font-semibold text-[#F5B742]">
            Sorteio
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">Por tempo limitado</span>
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        className="h-[42px] w-full rounded-[10px] px-3.5 text-center text-[13px] font-bold text-white"
        style={{ backgroundColor: p.offerButtonColor }}
      >
        {p.offerButtonText}
      </button>
    </div>
  );
}

export function OfferPreviewMobile(p: OfferPreviewProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[#1E241F] bg-[#070807] p-4 text-neutral-100 [&_h2]:text-base [&_h2]:font-bold">
      <p className="text-xs font-semibold text-[#7C867E]">Prévia para mobile</p>
      <OfferTitle title={p.offerTitle} variant={p.offerTitleStyle} />
      {p.offerImageMobileUrl ? (
        <img
          src={p.offerImageMobileUrl}
          alt="Imagem mobile"
          className="block w-[384px] max-w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-[110px] w-[384px] max-w-full items-center justify-center rounded-lg border border-dashed border-[#1E241F] text-xs text-[#7C867E]">
          384×110 px
        </div>
      )}
    </div>
  );
}
