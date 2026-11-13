"use client";
import { cn } from "@/lib/utils";

export interface LoginPreviewProps {
  logoUrl: string;
  loginLogoAlign: "LEFT" | "CENTER" | "RIGHT";
  title: string;
  loginButtonText: string;
  loginButtonColor: string;
  primaryColor: string;
  nameEnabled: boolean;
  emailEnabled: boolean;
  phoneEnabled: boolean;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  formFieldOrder: ReadonlyArray<"name" | "email" | "phone">;
  progressEnabled: boolean;
  progressStartPct: number;
  progressBarColor: string;
  progressTextColor: string;
  progressText: string;
}

const ALIGN_CLASS: Record<LoginPreviewProps["loginLogoAlign"], string> = {
  LEFT: "justify-start",
  CENTER: "justify-center",
  RIGHT: "justify-end"
};

/** Mirrors the public capture page (app/[slug]/_components/capture-form.tsx) with the editor's live values. */
export function LoginPreview(props: LoginPreviewProps) {
  const pct = Math.max(0, Math.min(100, props.progressStartPct || 0));

  const fieldsByKey: Record<"name" | "email" | "phone", { enabled: boolean; placeholder: string }> = {
    name: { enabled: props.nameEnabled, placeholder: props.namePlaceholder },
    email: { enabled: props.emailEnabled, placeholder: props.emailPlaceholder },
    phone: { enabled: props.phoneEnabled, placeholder: props.phonePlaceholder }
  };

  const progressMessage = props.progressText.replace(/\{pct\}/g, String(props.progressStartPct));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1E241F] bg-[#070807] p-4">
      {props.logoUrl ? (
        <div className={cn("flex w-full", ALIGN_CLASS[props.loginLogoAlign])}>
          <img src={props.logoUrl} alt="" className="h-auto max-h-56 max-w-full rounded-lg object-contain" />
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#1E241F] text-xs text-[#6E776F]">Sem logo</div>
      )}
      {props.progressEnabled ? (
        <div className="relative flex h-6 rounded-full bg-[#F2F5F2] p-0.5">
          <div className="rounded-full" style={{ width: `${pct}%`, backgroundColor: props.progressBarColor }} />
          <p className="absolute inset-y-0 left-3 flex items-center text-[11px] font-semibold" style={{ color: props.progressTextColor }}>
            {progressMessage}
          </p>
        </div>
      ) : null}
      <p className="text-base font-bold text-[#F2F5F2]">{props.title}</p>
      {props.formFieldOrder.map((key) => {
        const f = fieldsByKey[key];
        if (!f.enabled) return null;
        return (
          <input
            key={key}
            type={key === "email" ? "email" : "text"}
            placeholder={f.placeholder}
            aria-label={f.placeholder}
            disabled
            className="h-[42px] w-full rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5 text-sm placeholder:text-[#6E776F]"
          />
        );
      })}
      <button
        type="button"
        disabled
        className="h-[42px] w-full rounded-[10px] text-[13px] font-bold text-[#F2F5F2]"
        style={{ backgroundColor: props.loginButtonColor }}
      >
        {props.loginButtonText}
      </button>
    </div>
  );
}
