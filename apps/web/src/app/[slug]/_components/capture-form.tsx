"use client";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import "react-phone-number-input/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOptin } from "@/server/actions/public";
import type { PublicWebinar } from "@/lib/public-dto";

const PhoneInput = dynamic(() => import("react-phone-number-input"), { ssr: false });

export function CaptureForm({ w }: { w: PublicWebinar }) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState<string | undefined>("");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mx-auto mb-6 h-14 object-contain" /> : null}
      <h1 className="text-center text-3xl font-semibold">{w.title}</h1>
      {w.waitingSubtitle ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{w.waitingSubtitle}</p>
      ) : null}

      <form
        action={onSubmit}
        className="mt-8 space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        {w.nameEnabled ? (
          <div className="space-y-1">
            <Label htmlFor="name">Nome{w.nameRequired ? " *" : ""}</Label>
            <Input id="name" name="name" placeholder={w.namePlaceholder} required={w.nameRequired} />
          </div>
        ) : null}

        {w.emailEnabled ? (
          <div className="space-y-1">
            <Label htmlFor="email">Email{w.emailRequired ? " *" : ""}</Label>
            <Input id="email" name="email" type="email" placeholder={w.emailPlaceholder} required={w.emailRequired} />
          </div>
        ) : null}

        {w.phoneEnabled ? (
          <div className="space-y-1">
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
        ) : null}

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
