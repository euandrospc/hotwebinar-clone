import Link from "next/link";
import { getAttendanceReport } from "@/server/attendance/report";
export async function AttendanceReport({ ownerId, start, end }: { ownerId: string; start: Date; end: Date }) {
  const data = await getAttendanceReport(ownerId, start, end);
  return <section className="space-y-5 rounded-lg border bg-card p-5" aria-label="Relatório de atendimento">
    <header className="flex flex-wrap justify-between gap-2"><div><h2 className="text-sm font-semibold">Relatório de atendimento</h2><p className="mt-1 text-xs text-muted-foreground">Conversas com atividade no período selecionado. O status considera a última mensagem da conversa.</p></div><Link className="text-sm underline underline-offset-4" href="/atendimento">Abrir atendimento</Link></header>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{[
      ["Conversas", data.total], ["Pendentes", data.pending], ["Respondidas", data.answered],
      ["Respostas humanas", data.humanReplies], ["Respostas de IA", data.aiReplies],
      ["1ª resposta média", data.averageFirstReplySeconds === null ? "—" : `${Math.floor(data.averageFirstReplySeconds / 60)}min ${data.averageFirstReplySeconds % 60}s`]
    ].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="mb-2 text-left font-medium">Atendimentos por atendente</caption><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Atendente</th><th>Conversas atendidas</th><th>Respostas enviadas</th></tr></thead><tbody>{data.ranking.map(row => <tr className="border-b last:border-0" key={row.id}><td className="py-3">{row.name}</td><td>{row.conversations}</td><td>{row.replies}</td></tr>)}</tbody></table>{!data.ranking.length && <p className="py-3 text-sm text-muted-foreground">Nenhuma resposta humana neste período.</p>}</div>
    <p className="text-xs text-muted-foreground">Uma conversa pode ter participação de mais de um atendente. A média usa a primeira resposta após uma mensagem do espectador no período.</p>
  </section>;
}
