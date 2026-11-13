import type { ReactNode } from "react";
import Image from "next/image";
import { Radio, Sparkles, Users } from "@/components/icons";
import { cn } from "@/lib/utils";
import { LiveRoomCount, SaleFeed } from "./palco-live";
import { palcoFonts } from "./palco-fonts";
import roomImage from "./palco-room.webp";


/** Shared form classes for the sign-in and two-factor screens. */
export const palcoForm = {
  form: "grid gap-5",
  fields: "grid gap-4",
  field: "grid gap-2",
  label: "text-sm font-semibold text-neutral-300",
  input: "flex h-12 items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-neutral-400 transition focus-within:border-palco focus-within:shadow-lg focus-within:shadow-palco/20 [&>svg]:size-5 [&>svg]:shrink-0 [&_input]:h-full [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-base [&_input]:text-neutral-100 [&_input]:outline-none [&_input]:placeholder:text-neutral-500 [&_input:-webkit-autofill]:[-webkit-text-fill-color:theme(colors.neutral.100)] [&_input:-webkit-autofill]:[transition:background-color_9999s] [&_input:-webkit-autofill]:shadow-[inset_0_0_0_100px_theme(colors.neutral.900)]",
  visibility: "-mr-2 inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-white/5 hover:text-neutral-100 focus-visible:bg-white/5 focus-visible:text-neutral-100 [&>svg]:size-5",
  remember: "inline-flex w-fit cursor-pointer items-center gap-2.5 text-sm text-neutral-300",
  checkbox: "size-4 cursor-pointer rounded accent-palco",
  submit: "flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-palco text-base font-semibold text-neutral-950 transition hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-progress disabled:opacity-60 [&>svg]:size-5",
  secondary: "h-10 w-full rounded-lg text-sm text-neutral-400 outline-none hover:bg-white/5 hover:text-neutral-100 focus-visible:bg-white/5 focus-visible:text-neutral-100 disabled:opacity-60",
  error: "rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300",
  legal: "text-xs leading-normal text-neutral-500"
};

// Large monitors scale both panels up so type and the preview don't look tiny.
const zoom = "[@media(min-width:1920px)_and_(min-height:1150px)]:[zoom:1.15] [@media(min-width:2300px)_and_(min-height:1350px)]:[zoom:1.32] [@media(min-width:3000px)_and_(min-height:1700px)]:[zoom:1.7]";

const chat = [
  { author: "Juliana", text: "Isso funciona pra quem está começando do zero?" },
  { author: "Agente IA", text: "Funciona! O método vai do zero ao primeiro lançamento, passo a passo.", ai: true },
  { author: "Rafael", text: "Acabei de garantir a minha 🙌" }
];

const stats = [
  { value: "R$ 2,4 mi", label: "vendidos este mês" },
  { value: "38%", label: "retenção média até a oferta" },
  { value: "24/7", label: "agente de IA no chat" }
];

const chip = "inline-flex items-center gap-1.5 rounded-md bg-black/80 px-2.5 py-1.5 text-xs font-semibold";

function Brand() {
  return <div className="flex items-center gap-2.5">
    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-palco text-neutral-950"><Radio className="size-5" /></span>
    <span className="font-palco-serif text-3xl leading-none text-white">Palco</span>
  </div>;
}

/** Two-panel sign-in layout: illustrative room preview on the left, the form slot on the right. */
export function PalcoAuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className={cn(palcoFonts, "grid min-h-dvh bg-neutral-950 font-palco text-neutral-100 [color-scheme:dark] lg:grid-cols-[19fr_17fr]")}>
    {/* Tall screens keep the room and hero together in the middle instead of pushing them to the edges. */}
    <aside aria-hidden="true" className={cn("relative hidden flex-col items-center justify-between gap-8 overflow-hidden border-r border-neutral-900 bg-black bg-[radial-gradient(ellipse_160%_110%_at_85%_10%,rgb(74_222_128/18%),transparent_60%)] p-10 lg:flex xl:p-12 [&>*]:w-full [&>*]:max-w-2xl [@media(min-width:1024px)_and_(min-height:1080px)]:justify-start", zoom)}>
      <div className="flex items-center justify-between gap-4"><Brand /><LiveRoomCount /></div>

      <div className="relative [@media(min-width:1024px)_and_(min-height:1080px)]:mt-auto">
        <div className="flex h-80 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
          <div className="relative flex min-w-0 flex-1 flex-col justify-between p-4">
            <Image src={roomImage} alt="" fill priority sizes="(max-width: 1023px) 0px, 430px" className="object-cover" />
            <div className="relative flex items-center justify-between">
              <span className={cn(chip, "font-bold tracking-widest")}><span className="size-2 rounded-full bg-palco" />AO VIVO</span>
              <span className={chip}><Users className="size-3.5" />1.284</span>
            </div>
            <div className="relative flex items-center gap-3 rounded-xl border border-palco/25 bg-black/90 p-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <strong className="text-sm font-semibold">Mentoria Escala Digital</strong>
                <small className="text-xs text-neutral-400">de R$ 1.997 por R$ 997 · 12x</small>
              </span>
              <span className="whitespace-nowrap rounded-lg bg-palco px-3.5 py-2.5 text-xs font-bold text-neutral-950">Quero minha vaga</span>
            </div>
          </div>
          <div className="flex w-52 shrink-0 flex-col gap-3.5 overflow-hidden border-l border-neutral-800 p-4 xl:w-60">
            <div className="flex items-center justify-between text-sm">
              <strong className="font-semibold">Chat da sala</strong>
              <span className="inline-flex items-center gap-1 rounded-full bg-palco/10 px-2 py-0.5 text-xs font-semibold text-palco"><Sparkles className="size-3" />IA ativa</span>
            </div>
            {chat.map(message => <p key={message.author} className={cn("grid gap-1 text-xs leading-relaxed text-neutral-300", message.ai && "rounded-lg bg-palco/10 p-2.5")}>
              <b className={cn("font-bold", message.ai ? "text-palco" : "text-neutral-500")}>{message.author}</b>{message.text}
            </p>)}
          </div>
        </div>
        <SaleFeed className="!absolute -bottom-9 right-0 z-10 w-80" />
      </div>

      <div className="grid gap-6 [@media(min-width:1024px)_and_(min-height:1080px)]:mb-auto [@media(min-width:1024px)_and_(min-height:1080px)]:mt-24">
        <h2 className="font-palco-serif text-5xl leading-none tracking-tight text-white xl:text-6xl">Seu webinário<br />vendendo 24h por dia.</h2>
        <p className="max-w-lg text-lg leading-normal text-neutral-100/60">Grave uma vez e deixe a sala rodar sozinha: audiência, chat com agente de IA, ofertas e notificações de compra no momento certo.</p>
        <dl className="flex gap-10 border-t border-neutral-800 pt-5">
          {stats.map(stat => <div key={stat.value} className="grid gap-0.5">
            <dt className="font-palco-serif text-4xl leading-tight">{stat.value}</dt>
            <dd className="text-sm text-neutral-500">{stat.label}</dd>
          </div>)}
        </dl>
      </div>
    </aside>

    <section className={cn("flex flex-col justify-between gap-6 bg-[radial-gradient(ellipse_120%_50%_at_90%_0%,rgb(74_222_128/14%),transparent_70%)] px-6 pb-7 pt-6 lg:gap-8 lg:bg-none lg:p-10 xl:px-16", zoom)}>
      <div className="flex items-center justify-between gap-3 lg:hidden" aria-hidden="true"><Brand /><LiveRoomCount /></div>
      <div className="mb-2 lg:hidden" aria-hidden="true"><SaleFeed /></div>
      <div className="flex flex-1 justify-center lg:items-center">
        <div className="grid w-full max-w-md gap-7">
          <header className="grid gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-palco">{eyebrow}</span>
            <h1 id="auth-title" className="font-palco-serif text-4xl leading-none lg:text-5xl">{title}</h1>
            <p className="text-base leading-normal text-neutral-400">{description}</p>
          </header>
          {children}
        </div>
      </div>
      <footer className="flex flex-col items-start gap-2.5 text-xs text-neutral-500 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <span>© 2026 Palco · Webinários automáticos</span>
        <span className="flex gap-5 text-neutral-400"><span>Ajuda</span><span>Privacidade</span><span>Português (BR)</span></span>
      </footer>
    </section>
  </main>;
}
