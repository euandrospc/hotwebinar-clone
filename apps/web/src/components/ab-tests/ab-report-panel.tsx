"use client";

import { useState } from "react";
import { Info, ShieldCheck, TriangleAlert } from "@/components/icons";
import { AdminSurface } from "@/components/admin/admin-page";
import { AB_METRIC_LABELS, abMetricBase, type AbReport } from "@/lib/ab-tests";
import { cn } from "@/lib/utils";
import { count, dateLabel, money, percent, percentagePoints } from "./ab-utils";
import cardStyles from "@/components/dashboard/dashboard-card.module.css";
import styles from "./ab-tests.module.css";
import { AbDecisionSummary } from "./ab-decision-summary";
import { AbDiagnosticsPanel } from "./ab-diagnostics-panel";
import { AbComparisonTable } from "./ab-comparison-table";

const stages: { key: "identified" | "viewers" | "pitch" | "clicks" | "buyers"; label: string; description: string }[] = [
  { key: "identified", label: "Identificação", description: "Entradas com uma pessoa identificada e janela de conversão completa." },
  { key: "viewers", label: "Reprodução", description: "Entradas com registro de reprodução dentro da janela de conversão." },
  { key: "pitch", label: "Pitch", description: "Entradas com registro de chegada ao pitch dentro da janela." },
  { key: "clicks", label: "Oferta", description: "Entradas com pelo menos um clique na oferta dentro da janela." },
  { key: "buyers", label: "Compra", description: "Entradas com pelo menos uma compra atribuída dentro da janela." }
];

function VariantMark({ variant }: { variant: "A" | "B" }) {
  return <b className={variant === "A" ? styles.variantA : styles.variantB}>{variant}</b>;
}

export function AbReportPanel({ report }: { report: AbReport }) {
  const [stage, setStage] = useState(4);
  const [a, b] = report.variants;
  const { experiment, inference, integrity } = report;
  const randomized = experiment.mode === "RANDOMIZED";
  const recurring = experiment.observationUnit === "DAILY_SESSION";
  const winner = inference.state === "WINNER_A" || inference.state === "WINNER_B";
  const caution = ["INTEGRITY", "EARLY_STOP"].includes(inference.state);
  const selectedStage = stages[stage];
  const observed = report.readout === "OBSERVED";
  const pending = a.pending + b.pending;
  const partial = observed && pending > 0;


  return <div className={styles.report}>
    <div role="status" className={cn(styles.inference, winner && styles.inferenceWinner, caution && styles.inferenceCaution)}>
      {caution ? <TriangleAlert aria-hidden="true" /> : winner ? <ShieldCheck aria-hidden="true" /> : <Info aria-hidden="true" />}
      <div><strong>{partial ? "Resultados parciais" : inference.title}</strong><p>{partial ? `Dados registrados até agora, incluindo ${count(pending)} entradas que ainda não completaram ${experiment.conversionWindowHours}h. Os números podem aumentar; os públicos não foram sorteados.` : inference.detail}</p></div>
      <span className={styles.badge}>{randomized ? "Métrica principal" : "Leitura descritiva"}</span>
    </div>

    <div className={styles.kpis}>
      <section className={cn(cardStyles.card, cardStyles.financial, styles.kpi, styles.conversionKpi)} aria-label="Conversão por variante">
        <p>Conversão · {AB_METRIC_LABELS[experiment.metric].toLocaleLowerCase("pt-BR")}</p>
        <div className={styles.dualValue}><div><span>A · controle</span><strong>{percent(a.rate)}</strong></div><div><span>B · variante</span><strong>{percent(b.rate)}</strong></div></div>
        <small>{count(a.conversions)} e {count(b.conversions)} conversões atribuídas</small>
      </section>
      <section className={cn(cardStyles.card, styles.kpi)}><p>Variação observada de B sobre A</p><strong>{inference.relativeLift === null ? "—" : `${inference.relativeLift > 0 ? "+" : ""}${percent(inference.relativeLift)}`}</strong><small>{percentagePoints(inference.delta)} de diferença absoluta</small></section>
      <section className={cn(cardStyles.card, styles.kpi)}><p>{recurring ? "Receita atribuída · BRL" : "Receita da coorte · BRL"}</p><strong>{money(a.revenueCents + b.revenueCents)}</strong><small>A {money(a.revenueCents)} <span aria-hidden="true">·</span> B {money(b.revenueCents)}</small></section>
      <section className={cn(cardStyles.card, styles.kpi)}><p>Amostra com janela completa</p><strong>{count(a.mature + b.mature)}<span> / {count(a.assigned + b.assigned)}</span></strong><small>{count(a.pending + b.pending)} aguardando a janela de {experiment.conversionWindowHours}h</small></section>
    </div>

    <div className={styles.mainGrid}>
      <AdminSurface className={styles.funnelSurface}>
        <div className={styles.sectionHeading}><div><h3>Onde as versões se diferenciam</h3><p>{observed ? "Etapas registradas até agora sobre todos os acessos do recorte." : "Etapas sobre a mesma base de entradas com janela completa."}</p></div><div className={styles.legend}><span><VariantMark variant="A" />Controle</span><span><VariantMark variant="B" />Variante</span></div></div>
        <div className={styles.funnel} role="group" aria-label="Explorar etapas do comparativo">
          {stages.map((item, index) => <button type="button" key={item.key} aria-pressed={stage === index} className={cn(styles.funnelRow, stage === index && styles.funnelActive)} onClick={() => setStage(index)} onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next = (index + (event.key === "ArrowDown" ? 1 : stages.length - 1)) % stages.length;
              setStage(next);
              const sibling = event.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined;
              sibling?.focus();
            }
          }}>
            <span>{item.label}</span><div className={styles.funnelBars}>{[a, b].map(variant => <div key={variant.key}><div className={styles.track}><span className={variant.key === "A" ? styles.barA : styles.barB} style={{ width: `${abMetricBase(variant) ? Math.min(100, variant[item.key] / abMetricBase(variant) * 100) : 0}%` }} /></div><small><b>{count(variant[item.key])}</b> · {percent(abMetricBase(variant) ? variant[item.key] / abMetricBase(variant) : null)}</small></div>)}</div>
          </button>)}
        </div>
        <div className={styles.funnelDetail} aria-live="polite"><strong>{selectedStage.label}</strong><p>{observed && selectedStage.key === "identified" ? "Acessos identificados já observados no período, incluindo janelas ainda abertas." : selectedStage.description} Os registros não comprovam passagem sequencial entre todas as etapas.</p></div>
      </AdminSurface>

      <AbDecisionSummary report={report} />
    </div>

    <AbDiagnosticsPanel report={report} />

    <AdminSurface>
      <div className={styles.sectionHeading}><div><h3>Resultados lado a lado</h3><p>{randomized ? "Unidade de análise: visitante por navegador. Identificações em mais de um navegador são sinalizadas na integridade." : recurring ? "Unidade de análise: participação por pessoa, webinar e dia de atividade em Brasília. Retornos em dias diferentes contam novamente; cada pedido é atribuído uma vez." : "Unidade de análise: acesso identificado, deduplicado por pessoa e webinar."}</p></div></div>
      <AbComparisonTable report={report} />
      <p className={styles.smallNote}>{observed ? "Receita em BRL já registrada e atribuída dentro da janela de cada entrada, incluindo janelas ainda abertas." : "Receita em BRL registrada e atribuída dentro da janela, somente na coorte com janela completa."} Não representa lucro ou receita líquida.</p>
    </AdminSurface>

    <div className={styles.bottomGrid}>
      <AdminSurface><div className={styles.sectionHeading}><div><h3>Integridade dos dados</h3><p>Condições que podem alterar a interpretação do resultado.</p></div><ShieldCheck aria-hidden="true" /></div>
        <dl className={styles.evidenceList}><div><dt>Pessoas nos dois webinars</dt><dd>{count(integrity.overlapPeople)}</dd></div><div><dt>Identidades em mais de um navegador</dt><dd>{count(integrity.duplicateIdentities)}</dd></div><div><dt>Vendas sem atribuição à coorte</dt><dd>{count(integrity.unattributedSales)}</dd></div><div><dt>Vendas fora de BRL</dt><dd>{count(integrity.excludedCurrencySales)}</dd></div></dl>
        {integrity.warnings.length > 0 ? <ul className={styles.warnings}>{integrity.warnings.map((warning, index) => <li key={`${index}-${warning}`}><TriangleAlert aria-hidden="true" /><span>{warning}</span></li>)}</ul> : <p className={styles.smallNote}>Nenhum alerta de integridade registrado neste recorte. Ausência de alerta não garante ausência de viés.</p>}
      </AdminSurface>
      <AdminSurface><div className={styles.sectionHeading}><div><h3>Plano do teste</h3><p>{experiment.hypothesis}</p></div></div><dl className={styles.evidenceList}><div><dt>Métrica principal</dt><dd>{AB_METRIC_LABELS[experiment.metric]}</dd></div><div><dt>Janela por entrada</dt><dd>{experiment.conversionWindowHours} horas</dd></div><div><dt>Início</dt><dd>{dateLabel(experiment.startedAt)}</dd></div>{recurring && <><div><dt>Fim do acompanhamento</dt><dd>{dateLabel(experiment.endsAt)}</dd></div><div><dt>Duração planejada</dt><dd>{experiment.durationDays} dias</dd></div></>}{randomized && <><div><dt>Conversão base planejada</dt><dd>{percent(experiment.baselineRate)}</dd></div><div><dt>Efeito detectável planejado (MDE)</dt><dd>{percent(experiment.minimumDetectableLift)}</dd></div><div><dt>Confiança / poder planejados</dt><dd>95% / 80%</dd></div></>}</dl>
        <details className={styles.methodology}><summary>Como ler este teste</summary><div>{recurring && <p>O dia representa atividade identificada, não uma reconstrução exata da sessão agendada. Retornos em outro dia contam como nova participação. Eventos e compras pertencem à entrada elegível mais recente, dentro da janela; cada pedido aparece uma única vez. Pessoas únicas são deduplicadas em todo o recorte. Semanas têm sete dias desde o início; a última pode ser menor.</p>}<p>{observed ? "As taxas dividem os resultados já registrados por todos os acessos do recorte. Janelas ainda abertas podem acrescentar novas conversões; a comparação é parcial até todas terminarem." : "As taxas dividem as conversões pela amostra com janela completa."} Uma entrada pode converter uma vez por métrica; múltiplos pedidos podem contribuir para a receita.</p><p>Filtros selecionam a coorte pela data de entrada e pelos atributos de aquisição disponíveis. A janela de conversão permanece a mesma. Recortes e métricas secundárias são exploratórios.</p><p>Experimentos usam teste bilateral de duas proporções, amostra planejada e horizonte fixo. Não encerre ao primeiro sinal favorável. Pausas antes do fim tornam a leitura exploratória, mesmo após retomar. Falta de diferença conclusiva não prova equivalência.</p><p>Comparações históricas não demonstram causalidade. Dispositivos e UTMs ausentes permanecem identificados como não informados.</p><p><a href="https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/diffprci.htm" target="_blank" rel="noreferrer">Método estatístico · NIST</a><span> · </span><a href="https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/" target="_blank" rel="noreferrer">Integridade da divisão · Microsoft</a></p></div></details>
      </AdminSurface>
    </div>
  </div>;
}
