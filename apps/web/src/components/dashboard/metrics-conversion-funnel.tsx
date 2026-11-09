import { Users, UserCheck, MonitorPlay, MousePointerClick, DollarSign, Filter } from "@/components/icons";
import styles from "@/components/webinar/webinar-operations.module.css";

export interface ConversionFunnelData {
  visitantes: number;
  participantes: number;
  assistiuVivo: number;
  assistiuReplay: number;
  clicouVivo: number;
  clicouReplay: number;
  comprou: number;
}
const fmt = new Intl.NumberFormat("pt-BR");
function pct(part: number, whole: number): string {
  return whole <= 0 ? "0,00%" : `${((part / whole) * 100).toFixed(2).replace(".", ",")}%`;
}

export function MetricsConversionFunnel({ data }: { data: ConversionFunnelData }) {
  return <section className={styles.surface}>
    <h3 className={styles.surfaceTitle}><Filter aria-hidden="true" />Tráfego e conversão de página</h3>
    <div className={styles.tableScroll}>
      <div className={styles.flow}>
        <div className={styles.flowStep}>
          <p className={styles.flowLabel}><Users aria-hidden="true" />Visitantes</p>
          <p className={styles.flowValue}>{fmt.format(data.visitantes)}</p>
        </div>
        <div className={styles.flowStep}>
          <p className={styles.flowLabel}><UserCheck aria-hidden="true" />Participantes</p>
          <p className={styles.flowValue}>{fmt.format(data.participantes)}</p>
          <p className={styles.flowDetail}>Taxa de inscrição · {pct(data.participantes, data.visitantes)}</p>
        </div>
        <div className={styles.flowStep}>
          <p className={styles.flowLabel}><MonitorPlay aria-hidden="true" />Assistiram</p>
          <p className={styles.flowChannel}>Ao vivo <strong>{fmt.format(data.assistiuVivo)}</strong></p>
          <p className={styles.flowDetail}>Show up · {pct(data.assistiuVivo, data.participantes)}</p>
          <p className={styles.flowChannel}>Replay <strong>{fmt.format(data.assistiuReplay)}</strong></p>
          <p className={styles.flowDetail}>Show up · {pct(data.assistiuReplay, data.participantes)}</p>
        </div>
        <div className={styles.flowStep}>
          <p className={styles.flowLabel}><MousePointerClick aria-hidden="true" />Clicaram na oferta</p>
          <p className={styles.flowChannel}>Ao vivo <strong>{fmt.format(data.clicouVivo)}</strong></p>
          <p className={styles.flowDetail}>{pct(data.clicouVivo, data.assistiuVivo)} de quem assistiu</p>
          <p className={styles.flowChannel}>Replay <strong>{fmt.format(data.clicouReplay)}</strong></p>
          <p className={styles.flowDetail}>{pct(data.clicouReplay, data.assistiuReplay)} de quem assistiu</p>
        </div>
        <div className={styles.flowStep}>
          <p className={styles.flowLabel}><DollarSign aria-hidden="true" />Compraram</p>
          <p className={styles.flowValue}>{fmt.format(data.comprou)}</p>
        </div>
      </div>
    </div>
  </section>;
}
