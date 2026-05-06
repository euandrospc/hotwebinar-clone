"use client";
import { useState, useEffect, useTransition } from "react";
import dynamic from "next/dynamic";
import "react-phone-number-input/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOptin } from "@/server/actions/public";
import type { PublicWebinar } from "@/lib/public-dto";

const PhoneInput = dynamic(() => import("react-phone-number-input"), { ssr: false });

const ALIGN_CLASS: Record<"LEFT" | "CENTER" | "RIGHT", string> = {
  LEFT: "justify-start",
  CENTER: "justify-center",
  RIGHT: "justify-end"
};

export function CaptureForm({ w }: { w: PublicWebinar }) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState<string | undefined>("");
  const [error, setError] = useState<string | null>(null);
  const [utms, setUtms] = useState<{ source?: string; medium?: string; campaign?: string; term?: string; content?: string }>({});

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next: typeof utms = {};
    for (const k of ["source", "medium", "campaign", "term", "content"] as const) {
      const v = sp.get(`utm_${k}`);
      if (v) next[k] = v;
    }
    setUtms(next);
  }, []);

  function onSubmit(form: FormData) {
    setError(null);
    if (w.phoneEnabled) form.set("phone", phone ?? "");
    if (!w.slug) return;
    const slug = w.slug;
    startTransition(async () => {
      const r = await submitOptin(slug, form);
      if (r && "error" in r) setError(r.error.message);
    });
  }

  const fieldsByKey: Record<"name" | "email" | "phone", React.ReactNode> = {
    name: w.nameEnabled ? (
      <div className="space-y-1" key="name">
        <Label htmlFor="name">Nome{w.nameRequired ? " *" : ""}</Label>
        <Input id="name" name="name" placeholder={w.namePlaceholder} required={w.nameRequired} />
      </div>
    ) : null,
    email: w.emailEnabled ? (
      <div className="space-y-1" key="email">
        <Label htmlFor="email">Email{w.emailRequired ? " *" : ""}</Label>
        <Input id="email" name="email" type="email" placeholder={w.emailPlaceholder} required={w.emailRequired} />
      </div>
    ) : null,
    phone: w.phoneEnabled ? (
      <div className="space-y-1" key="phone">
        <Label>Telefone{w.phoneRequired ? " *" : ""}</Label>
        <PhoneInput
          defaultCountry="BR"
          international
          placeholder={w.phonePlaceholder}
          value={phone}
          onChange={setPhone}
          className="rounded-md border bg-background px-3 py-2"
        />
      </div>
    ) : null
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className={`mb-6 flex w-full ${ALIGN_CLASS[w.loginLogoAlign]}`}>
        {w.logoUrl ? <img src={w.logoUrl} alt="" className="h-14 object-contain" /> : null}
      </div>
      {w.progressEnabled ? <ProgressBar w={w} /> : null}
      <h1 className="text-center text-3xl font-semibold">{w.title}</h1>
      {w.waitingSubtitle ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{w.waitingSubtitle}</p>
      ) : null}

      <form
        action={onSubmit}
        className="mt-8 space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="utm_source" value={utms.source ?? ""} />
        <input type="hidden" name="utm_medium" value={utms.medium ?? ""} />
        <input type="hidden" name="utm_campaign" value={utms.campaign ?? ""} />
        <input type="hidden" name="utm_term" value={utms.term ?? ""} />
        <input type="hidden" name="utm_content" value={utms.content ?? ""} />
        {w.formFieldOrder.map((key) => fieldsByKey[key])}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="submit"
          disabled={pending}
          className="w-full"
          style={{ backgroundColor: w.loginButtonColor, color: "white" }}
        >
          {pending ? "Aguarde..." : w.loginButtonText}
        </Button>
      </form>
    </main>
  );
}

function ProgressBar({ w }: { w: import("@/lib/public-dto").PublicWebinar }) {
  const pct = w.progressStartPct;
  const text = w.progressText.replace(/\{pct\}/g, String(pct));
  return (
    <div className="mb-4 overflow-hidden rounded-full" style={{ background: w.progressBarColor }}>
      <div className="px-3 py-1.5 text-center text-xs font-semibold" style={{ color: w.progressTextColor }}>
        {text}
      </div>
    </div>
  );
}
