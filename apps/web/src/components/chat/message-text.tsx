"use client";
import { Fragment, useEffect, useState } from "react";

type Preview = { title: string; description: string; image: string | null; hostname: string };
function normalizeLink(raw: string) {
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const previews = new Map<string, Promise<Preview | null>>();
function LinkCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    let alive = true;
    if (!previews.has(url)) {
      if (previews.size >= 100) previews.delete(previews.keys().next().value!);
      previews.set(url, fetch(`/api/chat/link-preview?url=${encodeURIComponent(url)}`)
        .then(async response => response.ok ? await response.json() as Preview : null).catch(() => null));
    }
    void previews.get(url)!.then(result => { if (alive) setPreview(result); });
    return () => { alive = false; };
  }, [url]);
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${preview?.title || new URL(url).hostname}`} className="mt-2 block overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:ring-1 hover:ring-primary/30">
    {preview?.image && <img src={preview.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="max-h-32 w-full object-cover" onError={event => { event.currentTarget.hidden = true; }} />}
    <span className="block p-3">
      <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">{preview?.hostname || new URL(url).hostname}</span>
      <span className="mt-1 line-clamp-2 block text-sm font-semibold">{preview?.title || "Abrir link"}</span>
      {preview?.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{preview.description}</span>}
    </span>
  </a>;
}
export function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>]+)/gi);
  const links = [...new Set(parts.filter(part => /^https?:\/\//i.test(part)).map(part => normalizeLink(part.replace(/[.,!?;:]+$/, ""))).filter((url): url is string => !!url))].slice(0, 2);
  return <div className="min-w-0">
    <p className="whitespace-pre-wrap break-words">{parts.map((part, index) => {
      const raw = part.replace(/[.,!?;:]+$/, "");
      const url = /^https?:\/\//i.test(raw) ? normalizeLink(raw) : null;
      return url ? <Fragment key={index}><a className="underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{raw}</a>{part.slice(raw.length)}</Fragment> : <Fragment key={index}>{part}</Fragment>;
    })}</p>
    {links.map(url => <LinkCard key={url} url={url} />)}
  </div>;
}
