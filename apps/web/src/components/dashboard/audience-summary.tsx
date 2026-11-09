import styles from "@/components/webinar/webinar-operations.module.css";
import type { AudienceSummary as Summary } from "@/server/audience-history";

export function AudienceSummary({ data, timezone = "America/Sao_Paulo", period = "Período selecionado" }: {
  data: Summary; timezone?: string; period?: string;
}) {
  const zone = timezone === "__auto__" ? "America/Sao_Paulo" : timezone;
  return <section aria-label="Audiência simultânea" className={styles.surface}>
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold">Audiência simultânea</h2>
      <span className="text-xs text-muted-foreground">{period}</span>
    </header>
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <div><p className="text-[11px] text-muted-foreground">Média de espectadores simultâneos</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{data.average === null ? "—" : data.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p></div>
      <div><p className="text-[11px] text-muted-foreground">Pico de audiência registrado</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{data.peak === null ? "—" : data.peak.toLocaleString("pt-BR")}</p>
        {data.peakAt && <p className="mt-1 text-xs text-muted-foreground">{new Date(data.peakAt).toLocaleString("pt-BR", { timeZone: zone })}</p>}
      </div>
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{data.sampleCount ? "Média das leituras registradas a cada 15 s enquanto o webinar está aberto, incluindo leituras com zero espectadores. O pico é o maior valor observado nessas leituras." : "Ainda não há leituras neste período. A coleta automática registra o histórico a partir desta atualização."}</p>
  </section>;
}
