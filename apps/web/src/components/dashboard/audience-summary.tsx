import type { AudienceSummary as Summary } from "@/server/audience-history";

export function AudienceSummary({ data, timezone = "America/Sao_Paulo", period = "Período selecionado" }: {
  data: Summary; timezone?: string; period?: string;
}) {
  const zone = timezone === "__auto__" ? "America/Sao_Paulo" : timezone;
  return <section aria-label="Audiência simultânea" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-neutral-100">Audiência simultânea</h2>
      <span className="text-xs text-[#7C867E]">{period}</span>
    </header>
    <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5"><p className="text-xs text-[#7C867E]">Média de espectadores simultâneos</p><p className="text-[26px] font-semibold leading-tight tabular-nums text-neutral-100">{data.average === null ? "—" : data.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p></div>
      <div className="flex flex-col gap-1.5"><p className="text-xs text-[#7C867E]">Pico de audiência registrado</p><p className="text-[26px] font-semibold leading-tight tabular-nums text-neutral-100">{data.peak === null ? "—" : data.peak.toLocaleString("pt-BR")}</p>
        {data.peakAt && <p className="text-xs text-[#6E776F]">{new Date(data.peakAt).toLocaleString("pt-BR", { timeZone: zone })}</p>}
      </div>
    </div>
    <p className="text-xs leading-normal text-[#6E776F]">{data.sampleCount ? "Média das leituras registradas a cada 15 s enquanto o webinar está aberto, incluindo leituras com zero espectadores. O pico é o maior valor observado nessas leituras." : "Ainda não há leituras neste período. A coleta automática registra o histórico a partir desta atualização."}</p>
  </section>;
}
