import {
  Filter,
  Info,
  Users,
  UserCheck,
  MonitorPlay,
  RotateCcw,
  MousePointerClick,
  DollarSign
} from "lucide-react";

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
  if (whole <= 0) return "0,00%";
  return `${((part / whole) * 100).toFixed(2).replace(".", ",")}%`;
}

const ARROW = "text-slate-400 dark:text-slate-500 shrink-0";

function ArrowStraight({ long = false }: { long?: boolean }) {
  return long ? (
    <svg width="111" height="16" viewBox="0 0 111 16" fill="none" className={ARROW}>
      <path
        d="M110.707 8.70711C111.098 8.31658 111.098 7.68342 110.707 7.29289L104.343 0.928932C103.953 0.538408 103.319 0.538408 102.929 0.928932C102.538 1.31946 102.538 1.95262 102.929 2.34315L108.586 8L102.929 13.6569C102.538 14.0474 102.538 14.6805 102.929 15.0711C103.319 15.4616 103.953 15.4616 104.343 15.0711L110.707 8.70711ZM0 8V9H110V8V7H0V8Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="58" height="15" viewBox="0 0 58 15" fill="none" className={ARROW}>
      <path
        d="M57.7071 8.07136C58.0976 7.68084 58.0976 7.04768 57.7071 6.65715L51.3431 0.29319C50.9526 -0.0973344 50.3195 -0.0973344 49.9289 0.29319C49.5384 0.683714 49.5384 1.31688 49.9289 1.7074L55.5858 7.36426L49.9289 13.0211C49.5384 13.4116 49.5384 14.0448 49.9289 14.4353C50.3195 14.8259 50.9526 14.8259 51.3431 14.4353L57.7071 8.07136ZM0 7.36426V8.36426H57V7.36426V6.36426H0V7.36426Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowSplit() {
  return (
    <svg viewBox="0 0 226 120" fill="none" preserveAspectRatio="none" className={`${ARROW} h-full w-full`}>
      <path
        d="M225.707 8.07136C226.098 7.68084 226.098 7.04768 225.707 6.65715L219.343 0.29319C218.953 -0.0973344 218.319 -0.0973344 217.929 0.29319C217.538 0.683714 217.538 1.31688 217.929 1.7074L223.586 7.36426L217.929 13.0211C217.538 13.4116 217.538 14.0448 217.929 14.4353C218.319 14.8259 218.953 14.8259 219.343 14.4353L225.707 8.07136ZM0 59.6067V60.6067C63.0449 60.6067 95.0245 47.4952 123.441 34.3936C151.76 21.3366 176.406 8.36426 225 8.36426V7.36426V6.36426C175.932 6.36426 150.939 19.5131 122.603 32.5774C94.365 45.5969 62.6752 58.6067 0 58.6067V59.6067Z"
        fill="currentColor"
      />
      <path
        d="M225.707 111.14C226.098 111.53 226.098 112.163 225.707 112.554L219.343 118.918C218.953 119.308 218.319 119.308 217.929 118.918C217.538 118.527 217.538 117.894 217.929 117.504L223.586 111.847L217.929 106.19C217.538 105.799 217.538 105.166 217.929 104.776C218.319 104.385 218.953 104.385 219.343 104.776L225.707 111.14ZM0 59.6067V58.6067C63.0449 58.6067 95.0244 71.7175 123.441 84.8185C151.76 97.8749 176.406 110.847 225 110.847V111.847V112.847C175.932 112.847 150.939 99.6984 122.603 86.6348C94.3651 73.6158 62.6752 60.6067 0 60.6067V59.6067Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowMerge() {
  return (
    <svg viewBox="0 0 58 107" fill="none" preserveAspectRatio="none" className={`${ARROW} h-full w-full`}>
      <path
        d="M57.1886 52.5353C57.5791 52.9259 57.5791 53.559 57.1886 53.9495L50.8246 60.3135C50.4341 60.704 49.8009 60.704 49.4104 60.3135C49.0199 59.923 49.0199 59.2898 49.4104 58.8993L55.0672 53.2424L49.4104 47.5856C49.0199 47.1951 49.0199 46.5619 49.4104 46.1714C49.8009 45.7808 50.4341 45.7808 50.8246 46.1714L57.1886 52.5353ZM1 2C0.447716 2 0 1.55228 0 1C0 0.447715 0.447716 0 1 0V1V2ZM56.4814 53.2424V54.2424C48.4038 54.2424 42.3212 50.8226 37.4044 45.7775C32.5201 40.7657 28.753 34.116 25.2643 27.5928C21.7455 21.0134 18.5229 14.5932 14.6874 9.78661C10.8752 5.00936 6.5925 2 1 2V1V0C7.44836 0 12.2462 3.52094 16.2506 8.53915C20.2317 13.5281 23.5617 20.1684 27.028 26.6496C30.5243 33.1871 34.1748 39.598 38.8367 44.3816C43.4663 49.132 49.0588 52.2424 56.4814 52.2424V53.2424Z"
        fill="currentColor"
      />
      <path
        d="M57.1886 53.9495C57.5791 53.559 57.5791 52.9258 57.1886 52.5353L50.8246 46.1714C50.4341 45.7808 49.8009 45.7808 49.4104 46.1714C49.0199 46.5619 49.0199 47.195 49.4104 47.5856L55.0672 53.2424L49.4104 58.8993C49.0199 59.2898 49.0199 59.923 49.4104 60.3135C49.8009 60.704 50.4341 60.704 50.8246 60.3135L57.1886 53.9495ZM1 104.482C0.447716 104.482 0 104.93 0 105.482C0 106.035 0.447716 106.482 1 106.482V105.482V104.482ZM56.4814 53.2424V52.2424C48.4038 52.2424 42.3212 55.6621 37.4044 60.707C32.5201 65.7185 28.753 72.368 25.2643 78.8908C21.7456 85.4699 18.5229 91.8899 14.6874 96.6962C10.8752 101.473 6.59252 104.482 1 104.482V105.482V106.482C7.44834 106.482 12.2462 102.962 16.2506 97.9437C20.2317 92.955 23.5617 86.315 27.0279 79.834C30.5243 73.2969 34.1747 66.8863 38.8367 62.1029C43.4663 57.3527 49.0588 54.2424 56.4814 54.2424V53.2424Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Node({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[78px] flex-col items-center text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {icon}
      </span>
      <span className="mt-1 text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function StraightWithCaption({
  long,
  top,
  bottom
}: {
  long?: boolean;
  top?: string;
  bottom?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-1 text-center">
      {top ? <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">{top}</span> : null}
      <ArrowStraight long={long} />
      {bottom ? <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{bottom}</span> : null}
    </div>
  );
}

export function MetricsConversionFunnel({ data }: { data: ConversionFunnelData }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Tráfego e conversão de página</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </header>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-2">
          <Node icon={<Users className="h-5 w-5" />} label="Visitantes" value={fmt.format(data.visitantes)} />
          <StraightWithCaption long top="Taxa de inscrição" bottom={pct(data.participantes, data.visitantes)} />
          <Node icon={<UserCheck className="h-5 w-5" />} label="Participantes" value={fmt.format(data.participantes)} />

          <div className="relative flex h-[160px] top-[10px] w-[96px] shrink-0 self-stretch">
            <ArrowSplit />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center text-[10px] font-medium leading-none text-muted-foreground">
              <span>{pct(data.assistiuVivo, data.participantes)}</span>
              <span className="text-[9px] uppercase tracking-wide">Show up</span>
              <span>{pct(data.assistiuReplay, data.participantes)}</span>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-10">
            <div className="flex items-center gap-2">
              <Node icon={<MonitorPlay className="h-5 w-5" />} label="Assistiu ao vivo" value={fmt.format(data.assistiuVivo)} />
              <StraightWithCaption bottom={pct(data.clicouVivo, data.assistiuVivo)} />
              <Node icon={<MousePointerClick className="h-5 w-5" />} label="Clicou no botão" value={fmt.format(data.clicouVivo)} />
            </div>
            <div className="flex items-center gap-2">
              <Node icon={<RotateCcw className="h-5 w-5" />} label="Assistiu replay" value={fmt.format(data.assistiuReplay)} />
              <StraightWithCaption bottom={pct(data.clicouReplay, data.assistiuReplay)} />
              <Node icon={<MousePointerClick className="h-5 w-5" />} label="Clicou no botão" value={fmt.format(data.clicouReplay)} />
            </div>
          </div>

          <div className="flex w-[52px] relative top-[12px] h-[155px] shrink-0 self-stretch">
            <ArrowMerge />
          </div>
          <Node icon={<DollarSign className="h-5 w-5" />} label="Comprou" value={fmt.format(data.comprou)} />
        </div>
      </div>
    </section>
  );
}
