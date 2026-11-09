import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "@/components/icons";
import { getAttendanceReport } from "@/server/attendance/report";

const fmt = new Intl.NumberFormat("pt-BR");

export async function AttendanceReport({ ownerId, start, end }: { ownerId: string; start: Date; end: Date }) {
  const data = await getAttendanceReport(ownerId, start, end);
  const firstReply = data.averageFirstReplySeconds === null
    ? "—"
    : `${Math.floor(data.averageFirstReplySeconds / 60)}m ${data.averageFirstReplySeconds % 60}s`;

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-none" aria-label="Relatório de atendimento">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Atendimento</h2>
        <Link href="/atendimento" className="inline-flex items-center gap-1 text-xs font-medium text-[#0b5141] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5141] dark:text-[#a8dd70]">
          Abrir atendimento <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Conversas", fmt.format(data.total)],
          ["Pendentes", fmt.format(data.pending)],
          ["Finalizadas", fmt.format(data.closed)],
          ["1ª resposta média", firstReply]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-border/60 pt-3">
        {data.ranking.length ? (
          <div className="max-h-36 overflow-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">Atendimentos por atendente</caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-2 text-left font-normal">Atendente</th>
                  <th scope="col" className="pb-2 pl-3 text-right font-normal">Conversas</th>
                  <th scope="col" className="pb-2 pl-3 text-right font-normal">Respostas</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-40 truncate py-1.5 pr-3" title={row.name}>{row.name}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{fmt.format(row.conversations)}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{fmt.format(row.replies)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-3 text-xs text-muted-foreground">Nenhuma resposta humana neste período.</p>
        )}
      </div>

      <details className="group mt-auto pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5141] [&::-webkit-details-marker]:hidden">
          Detalhes do atendimento
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
          {[
            ["Respondidas", data.answered],
            ["Respostas humanas", data.humanReplies],
            ["Respostas de IA", data.aiReplies]
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{fmt.format(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Conversas com atividade no período selecionado. O status considera o encerramento e a última mensagem da conversa.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Uma conversa pode ter participação de mais de um atendente. A média usa a primeira resposta após uma mensagem do espectador no período.
        </p>
      </details>
    </section>
  );
}
