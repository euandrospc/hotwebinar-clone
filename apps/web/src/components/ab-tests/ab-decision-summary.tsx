"use client";

import { Info, ShieldCheck, TriangleAlert } from "@/components/icons";
import { AdminSurface } from "@/components/admin/admin-page";
import { AB_METRIC_LABELS, abMetricBase, type AbInferenceState, type AbReport } from "@/lib/ab-tests";
import { count, dateLabel, money, percent, percentagePoints } from "./ab-utils";
import styles from "./ab-decision-summary.module.css";

const formatPValue = (value: number | null) => value === null ? "—" : value < .0001 ? "< 0,0001" : value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const difference = (a: number | null, b: number | null) => a === null || b === null ? null : b - a;
const moneyDifference = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${money(value)}`;

function nextStep(report: AbReport): { title: string; description: string } {
  const state = report.inference.state;
  const missingA = Math.max(0, report.experiment.sampleSizePerVariant - report.variants[0].mature);
  const missingB = Math.max(0, report.experiment.sampleSizePerVariant - report.variants[1].mature);
  const pending = report.variants[0].pending + report.variants[1].pending;
  if (state === "OBSERVATIONAL" && report.readout === "OBSERVED" && pending > 0) return { title: "Acompanhe os resultados já registrados", description: `${count(pending)} entradas ainda não completaram ${report.experiment.conversionWindowHours}h. Compare os dados parciais, considerando o tempo de observação diferente e a origem dos públicos; isso não declara um horário vencedor.` };
  if (report.experiment.observationUnit === "DAILY_SESSION") return { title: "Compare dias, semanas e o total", description: "Observe se a diferença entre os horários se repete. Considere o tamanho e a origem dos públicos, a chegada ao pitch e as compras por participação. O acompanhamento reúne " + report.experiment.durationDays + " dias; resultados com janela aberta ainda podem mudar." };
  const finalReadoutAt = report.experiment.endsAt ? new Date(new Date(report.experiment.endsAt).getTime() + report.experiment.conversionWindowHours * 3_600_000).toISOString() : null;
  const plan: Record<AbInferenceState, { title: string; description: string }> = {
    DRAFT: { title: "Revise a mudança antes de iniciar", description: "Confirme o que muda de A para B, a métrica principal e o funcionamento dos eventos e da integração de vendas." },
    OBSERVATIONAL: { title: "Transforme a diferença em uma hipótese", description: "Use o histórico para escolher a próxima mudança. Valide-a com distribuição aleatória do mesmo tráfego de entrada." },
    EXPLORATORY: { title: "Volte ao conjunto completo para decidir", description: "Este recorte ajuda a investigar o público. A leitura principal usa o período e a população completos do experimento." },
    COLLECTING: { title: "Mantenha a coleta até o prazo planejado", description: `Preserve as versões até ${dateLabel(report.experiment.endsAt)}. Faltam ${count(missingA)} entradas com janela completa em A e ${count(missingB)} em B para a amostra planejada.` },
    MATURING: { title: "Aguarde as janelas de conversão", description: pending > 0 ? `A coleta acabou; ${count(pending)} entradas ainda aguardam a janela de ${report.experiment.conversionWindowHours}h. As compras elegíveis continuam sendo observadas.` : `As entradas atuais já completaram suas janelas. A leitura final aguarda o encerramento da janela planejada de ${report.experiment.conversionWindowHours}h após a coleta${finalReadoutAt ? `, em ${dateLabel(finalReadoutAt)}` : ""}.` },
    INSUFFICIENT: { title: "Planeje um novo teste viável", description: "Revise tráfego disponível, duração e efeito detectável. Não prolongue este teste apenas para tentar obter significância." },
    INTEGRITY: { title: "Investigue os alertas antes de decidir", description: "Confira a divisão de tráfego, as identidades repetidas e mudanças nas versões. Corrija a causa e reavalie a necessidade de um novo teste." },
    EARLY_STOP: { title: "Use o resultado como aprendizado", description: "A interrupção impede uma conclusão confirmatória. Planeje um novo experimento com versões estáveis e coleta sem interrupções." },
    WINNER_A: { title: "Avalie A junto ao resultado comercial", description: `A evidência favorece A em ${AB_METRIC_LABELS[report.experiment.metric].toLocaleLowerCase("pt-BR")}. Confirme a atribuição das compras, a receita por entrada e o esforço da mudança antes de avaliar a adoção.` },
    WINNER_B: { title: "Avalie B junto ao resultado comercial", description: `A evidência favorece B em ${AB_METRIC_LABELS[report.experiment.metric].toLocaleLowerCase("pt-BR")}. Confirme a atribuição das compras, a receita por entrada e o esforço da mudança antes de avaliar a adoção.` },
    INCONCLUSIVE: { title: "Reformule a hipótese para o próximo teste", description: "Não houve diferença demonstrada; isso não prova equivalência. Revise a mudança e seu impacto esperado antes de repetir o experimento." }
  };
  return plan[state];
}

export function AbDecisionSummary({ report }: { report: AbReport }) {
  const [a, b] = report.variants;
  const baseA = abMetricBase(a), baseB = abMetricBase(b);
  const observed = report.readout === "OBSERVED";
  const purchaseA = baseA ? a.buyers / baseA : null;
  const purchaseB = baseB ? b.buyers / baseB : null;
  const revenueA = baseA ? a.revenueCents / baseA : null;
  const revenueB = baseB ? b.revenueCents / baseB : null;
  const purchaseDelta = difference(purchaseA, purchaseB);
  const revenueDelta = difference(revenueA, revenueB);
  const primaryDelta = report.inference.delta;
  const intermediate = report.experiment.metric !== "PURCHASE";
  const purchaseDiverges = intermediate && primaryDelta !== null && purchaseDelta !== null && primaryDelta * purchaseDelta < 0;
  const revenueDiverges = intermediate && primaryDelta !== null && revenueDelta !== null && primaryDelta * revenueDelta < 0;
  const favored = primaryDelta !== null && primaryDelta > 0 ? "B" : "A";
  const step = nextStep(report);
  const randomized = report.experiment.mode === "RANDOMIZED";

  return <AdminSurface className={styles.surface}>
    <div className={styles.header}><div><h3>O que fazer com o resultado</h3><p>Conecte a métrica principal ao resultado comercial.</p></div><ShieldCheck aria-hidden="true" /></div>
    <div className={styles.nextStep}><span>Próximo passo</span><strong>{step.title}</strong><p>{step.description}</p></div>
    {randomized && <div className={styles.sampleInline}>{[a, b].map(variant => <div key={variant.key}><p><span>{variant.key} · amostra</span><strong>{count(variant.mature)} <small>/ {count(report.experiment.sampleSizePerVariant)}</small></strong></p><progress aria-label={`Progresso da amostra ${variant.key}`} value={Math.min(variant.mature, report.experiment.sampleSizePerVariant)} max={report.experiment.sampleSizePerVariant || 1} /></div>)}</div>}
    <div className={styles.commercialHeader}><h4>Leitura comercial</h4><span>Descritiva</span></div>
    <div className={styles.tableWrap}><table aria-label="Comparação comercial A e B"><thead><tr><th>Indicador</th><th>A</th><th>B</th><th>B − A</th></tr></thead><tbody><tr><th scope="row">Compra</th><td>{percent(purchaseA)}</td><td>{percent(purchaseB)}</td><td>{percentagePoints(purchaseDelta)}</td></tr><tr><th scope="row">Receita / entrada</th><td>{revenueA === null ? "—" : money(revenueA)}</td><td>{revenueB === null ? "—" : money(revenueB)}</td><td>{moneyDifference(revenueDelta)}</td></tr></tbody></table></div>
    <p className={styles.baseNote}>{observed ? "Base observada até agora" : "Base com janela completa"}: A {count(baseA)} · B {count(baseB)}. Compras conforme atribuição registrada; receita em BRL sem dedução de estornos.</p>
    {(purchaseDiverges || revenueDiverges) && <div className={styles.divergence} role="note"><TriangleAlert aria-hidden="true" /><p>A taxa de {AB_METRIC_LABELS[report.experiment.metric].toLocaleLowerCase("pt-BR")} é maior em {favored}, mas {purchaseDiverges && revenueDiverges ? "a compra e a receita por entrada são menores" : purchaseDiverges ? "a compra é menor" : "a receita por entrada é menor"} nessa versão. Investigue essa divergência antes de adotar a mudança.</p></div>}
    <details className={styles.evidence}>
      <summary>{randomized ? "Ver amostra e critérios estatísticos" : "Ver limites desta comparação"}</summary>
      {randomized ? <>
        <dl className={styles.facts}><div><dt>Coleta planejada</dt><dd>{report.experiment.durationDays} dias</dd></div><div><dt>Fim da coleta</dt><dd>{dateLabel(report.experiment.endsAt)}</dd></div><div><dt>Distribuição planejada</dt><dd>50% A / 50% B</dd></div><div><dt>p-valor da distribuição (SRM)</dt><dd>{formatPValue(report.integrity.srmPValue)}</dd></div><div><dt>p-valor da métrica principal</dt><dd>{formatPValue(report.inference.pValue)}</dd></div><div><dt>Intervalo da diferença · 95%</dt><dd>{report.inference.interval ? `${percentagePoints(report.inference.interval[0])} a ${percentagePoints(report.inference.interval[1])}` : "—"}</dd></div><div><dt>Efeito detectável planejado (MDE)</dt><dd>{percent(report.experiment.minimumDetectableLift)} relativo</dd></div></dl>
        <p className={styles.note}>O MDE dimensiona a amostra; não é um mínimo comercial comprovado nem uma regra automática de adoção. O p-valor não é a chance de uma versão vencer.</p>
      </> : <p className={styles.note}>Os públicos não foram sorteados. Campanhas, datas e composição da audiência podem explicar diferenças. Há {count(report.integrity.overlapPeople)} pessoas identificadas nos dois webinars.</p>}
      <p className={styles.limit}><Info aria-hidden="true" /><span>Esta leitura comercial não é um teste estatístico de segurança. Lucro, ROAS e CPA não estão disponíveis: faltam custos de aquisição e dedução de estornos.</span></p>
    </details>
  </AdminSurface>;
}
