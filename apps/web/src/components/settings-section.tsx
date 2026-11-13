"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "@/components/icons";
import { cn } from "@/lib/utils";

export const settingsUi = {
  card: "flex min-w-0 flex-1 flex-col gap-[18px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6 max-sm:p-4",
  label: "text-[13px] font-semibold text-[#C9D1CA]",
  hint: "text-xs text-[#6E776F]",
  input: "h-[42px] w-full min-w-0 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5 text-sm text-neutral-100 placeholder:text-[#6E776F] focus-visible:border-palco/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/30 disabled:opacity-50",
  footer: "flex flex-wrap items-center justify-between gap-3 border-t border-[#1A1F1B] pt-4",
  primary: "inline-flex h-[38px] shrink-0 items-center gap-2 rounded-[10px] bg-palco px-3.5 text-[13px] font-bold text-palco-ink transition-colors hover:bg-palco/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0E0C] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-[15px]",
  secondary: "inline-flex h-[38px] shrink-0 items-center gap-2 rounded-[10px] border border-[#1E241F] px-3.5 text-[13px] font-bold text-neutral-100 transition-colors hover:bg-[#121512] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-[15px]",
  error: "text-xs text-[#F0605A]"
};

export function SettingsSection({ icon, title, description, children }: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-[#1A1F1B] py-7 lg:flex-row lg:gap-12">
      <div className="flex shrink-0 flex-col gap-2 lg:w-[300px]">
        <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-palco/[0.08] text-palco [&_svg]:size-4" aria-hidden="true">{icon}</span>
        <h2 className="mt-1 text-base font-semibold text-neutral-100">{title}</h2>
        <p className="text-[13px] leading-normal text-[#7C867E]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsField({ id, label, hint, error, children }: {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={settingsUi.label}>{label}</label>
        {hint && <span className={settingsUi.hint}>{hint}</span>}
      </div>
      {children}
      {error && <p className={settingsUi.error}>{error}</p>}
    </div>
  );
}

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={cn(settingsUi.input, "pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[10px] text-[#6E776F] hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 [&_svg]:size-[15px]"
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
