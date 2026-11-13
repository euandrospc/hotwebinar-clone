"use client";

import { ArrowLeft, ChevronDown, LogOut, Menu, MessageSquare } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatar } from "@/lib/generate-avatar";

export interface InboxMetrics {
  pending: number;
  averageFirstReplySeconds: number | null;
  answeredToday: number;
}

interface WorkspaceHeaderProps {
  attendantName: string;
  isAdmin: boolean;
  status: string;
  onlineTotal: number;
  metrics: InboxMetrics | null;
  drawerOpen: boolean;
  onToggleConversations: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const menuItem = "gap-2 rounded-md px-2.5 py-2 text-[13px] text-neutral-300 focus:bg-[#151915] focus:text-neutral-100 [&_svg]:h-4 [&_svg]:w-4";

export function WorkspaceHeader({
  attendantName,
  isAdmin,
  status,
  onlineTotal,
  metrics,
  drawerOpen,
  onToggleConversations,
  onLogout,
  loggingOut,
}: WorkspaceHeaderProps) {
  const connected = status === "connected";
  const connectionLabel = connected ? "Conectado" : status === "fallback" ? "Atualização periódica" : "Reconectando…";
  const initials = generateAvatar(attendantName)?.letters ?? "AT";
  const kpis = [
    { label: "Pendentes", value: metrics ? String(metrics.pending) : "—", tone: metrics?.pending ? "text-[#F5B742]" : "text-neutral-100" },
    { label: "1ª resposta média", value: formatDuration(metrics?.averageFirstReplySeconds), tone: "text-neutral-100" },
    { label: "Respondidas hoje", value: metrics ? String(metrics.answeredToday) : "—", tone: "text-neutral-100" },
  ];

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#1A1F1B] bg-[#070807] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <button type="button" onClick={onToggleConversations} aria-label="Abrir conversas" aria-expanded={drawerOpen}
          aria-controls="attendant-conversations"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#1E241F] text-neutral-400 transition-colors hover:bg-[#121512] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50 lg:hidden">
          <Menu aria-hidden="true" className="h-4 w-4" />
        </button>
        <span aria-hidden="true" className="hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-palco text-palco-ink sm:grid">
          <MessageSquare className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold leading-5 text-neutral-100">Atendimento</h1>
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-neutral-400">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-palco" : "bg-[#F5B742]"}`} />
            <span className="truncate">
              <span aria-label="Conexão do atendimento" title={connectionLabel}>{connectionLabel}</span>
              {" · "}<span className="tabular-nums">{onlineTotal}</span> online agora na sala
            </span>
          </p>
        </div>
      </div>

      <dl aria-label="Indicadores de hoje" className="hidden items-center gap-7 xl:flex">
        {kpis.map(kpi => (
          <div key={kpi.label} className="flex items-center gap-2">
            <dt className="text-xs text-[#7C867E]">{kpi.label}</dt>
            <dd className={`text-sm font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex shrink-0 items-center gap-4">
        {isAdmin && (
          <a href="/dashboard" className="hidden items-center gap-1.5 rounded-[9px] border border-[#1E241F] px-3 py-[7px] text-[13px] font-medium text-[#C9D1CA] transition-colors hover:bg-[#121512] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50 sm:flex">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-neutral-400" />
            Dashboard
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Abrir menu da conta de ${attendantName}`}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-[#121512] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50">
              <span aria-hidden="true" className="grid h-[30px] w-[30px] place-items-center rounded-full bg-palco/[0.12] text-[11px] font-bold text-palco">{initials}</span>
              <span className="hidden max-w-32 truncate text-[13px] font-semibold text-neutral-100 sm:block">{attendantName}</span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-[#6E776F]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8}
            className="w-56 rounded-xl border-[#1E241F] bg-[#0C0E0C] p-1.5 font-palco text-neutral-100">
            <DropdownMenuLabel className="px-2.5 py-2">
              <span className="block truncate text-[13px] font-semibold">{attendantName}</span>
              <span className="block text-[11px] font-normal text-[#7C867E]">Sua conta</span>
            </DropdownMenuLabel>
            {isAdmin && (
              <DropdownMenuItem asChild className={`${menuItem} sm:hidden`}>
                <a href="/dashboard"><ArrowLeft aria-hidden="true" />Dashboard</a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={loggingOut} onSelect={onLogout} className={menuItem}>
              <LogOut aria-hidden="true" />
              {loggingOut ? "Saindo…" : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
