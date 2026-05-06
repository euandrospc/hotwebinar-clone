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

export function LoginPreview(props: LoginPreviewProps) {
  const pct = props.progressStartPct;

  const fieldsByKey: Record<"name" | "email" | "phone", { enabled: boolean; placeholder: string }> = {
    name: { enabled: props.nameEnabled, placeholder: props.namePlaceholder },
    email: { enabled: props.emailEnabled, placeholder: props.emailPlaceholder },
    phone: { enabled: props.phoneEnabled, placeholder: props.phonePlaceholder }
  };

  const progressMessage = props.progressText.replace(/\{pct\}/g, String(pct));

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia</p>
      <div className={cn("flex w-full", ALIGN_CLASS[props.loginLogoAlign])}>
        {props.logoUrl ? <img src={props.logoUrl} alt="" className="h-12 object-contain" /> : <div className="h-12" />}
      </div>
      {props.progressEnabled ? (
        <div className="overflow-hidden rounded-full" style={{ background: props.progressBarColor }}>
          <div
            className="px-3 py-1.5 text-center text-xs font-semibold"
            style={{ color: props.progressTextColor }}
          >
            {progressMessage}
          </div>
        </div>
      ) : null}
      <p className="text-base font-semibold">{props.title}</p>
      <div className="space-y-2">
        {props.formFieldOrder.map((key) => {
          const f = fieldsByKey[key];
          if (!f.enabled) return null;
          return (
            <div key={key}>
              <input
                type={key === "email" ? "email" : "text"}
                placeholder={f.placeholder}
                disabled
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled
        className="w-full rounded-md py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: props.loginButtonColor }}
      >
        {props.loginButtonText}
      </button>
    </div>
  );
}
