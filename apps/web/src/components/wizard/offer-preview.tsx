"use client";

export interface OfferPreviewProps {
  offerName?: string;
  offerTitle: string;
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
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      {p.offerImageDesktopUrl ? (
        <img src={p.offerImageDesktopUrl} alt="" className="w-full rounded-md object-cover" />
      ) : null}
      <div className="flex items-end justify-between gap-2 text-sm">
        <div>
          {p.offerPriceOriginal ? (
            <p className="text-muted-foreground line-through">De {p.offerPriceOriginal}</p>
          ) : null}
          {p.offerPriceFinal ? (
            <p className="text-lg font-semibold">Por {p.offerPriceFinal}</p>
          ) : null}
        </div>
        {p.offerRaffleEnabled ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            🎉 Sorteio
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Por tempo limitado</span>
        )}
      </div>
      <button
        type="button"
        className="w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow"
        style={{ backgroundColor: p.offerButtonColor }}
      >
        {p.offerButtonText}
      </button>
    </div>
  );
}

export function OfferPreviewMobile(p: OfferPreviewProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <p className="border-b px-3 py-2 text-xs text-muted-foreground">Prévia da oferta para mobile</p>
      {p.offerImageMobileUrl ? (
        <img
          src={p.offerImageMobileUrl}
          alt="Imagem mobile"
          className="block h-[110px] w-[384px] max-w-full object-cover"
        />
      ) : (
        <div className="flex h-[110px] items-center justify-center text-xs text-muted-foreground">
          384×110 px
        </div>
      )}
    </div>
  );
}
