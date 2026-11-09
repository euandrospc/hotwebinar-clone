"use client";

import { useTheme } from "next-themes";
import { ArrowLeft, ChevronDown, LogOut, Menu, MessageSquare, Moon, Sun } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatar } from "@/lib/generate-avatar";
import styles from "./workspace-header.module.css";

interface WorkspaceHeaderProps {
  attendantName: string;
  isAdmin: boolean;
  status: string;
  onlineTotal: number;
  drawerOpen: boolean;
  onToggleConversations: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export function WorkspaceHeader({
  attendantName,
  isAdmin,
  status,
  onlineTotal,
  drawerOpen,
  onToggleConversations,
  onLogout,
  loggingOut,
}: WorkspaceHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const connectionLabel = status === "connected"
    ? "Conectado"
    : status === "fallback"
      ? "Atualização periódica"
      : "Reconectando…";
  const initials = generateAvatar(attendantName)?.letters ?? "AT";

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <button
          type="button"
          onClick={onToggleConversations}
          aria-label="Abrir conversas"
          aria-expanded={drawerOpen}
          aria-controls="attendant-conversations"
          className={`${styles.iconButton} ${styles.mobileToggle}`}
        >
          <Menu aria-hidden="true" className="h-4 w-4" />
        </button>
        <span className={styles.brandIcon} aria-hidden="true">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className={styles.heading}>
          <h1>Atendimento</h1>
          <div className={styles.metadata}>
            <span aria-label="Conexão do atendimento" title={connectionLabel} className={styles.connection}>
              {connectionLabel}
            </span>
            <span className={styles.online}>
              <span className={styles.presenceDot} data-active={onlineTotal > 0} aria-hidden="true" />
              <span><span className="tabular-nums">{onlineTotal}</span> online agora</span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {isAdmin && (
          <a href="/dashboard" className={styles.dashboardLink}>
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Dashboard
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.accountButton} aria-label={`Abrir menu da conta de ${attendantName}`}>
              <span className={styles.avatar} aria-hidden="true">{initials}</span>
              <span className={styles.accountName}>{attendantName}</span>
              <ChevronDown aria-hidden="true" className={styles.chevron} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8} className={styles.accountMenu}>
            <DropdownMenuLabel className={styles.menuHeading}>
              <span className="block truncate font-medium">{attendantName}</span>
              <span className={styles.menuCaption}>Sua conta</span>
            </DropdownMenuLabel>
            {isAdmin && (
              <DropdownMenuItem asChild className={`${styles.menuItem} ${styles.mobileDashboard}`}>
                <a href="/dashboard"><ArrowLeft aria-hidden="true" />Dashboard</a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")} className={styles.menuItem}>
              {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {isDark ? "Mudar para claro" : "Mudar para escuro"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={loggingOut} onSelect={onLogout} className={styles.menuItem}>
              <LogOut aria-hidden="true" />
              {loggingOut ? "Saindo…" : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
