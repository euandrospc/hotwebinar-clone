"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "@/components/icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RealtimeWebinarOption } from "@/lib/webinar-realtime-v5";
import styles from "./realtime-dashboard-v5.module.css";

export function RealtimeBreadcrumbV5({ webinarId, webinarTitle, webinars = [] }: {
  webinarId?: string;
  webinarTitle?: string;
  webinars?: RealtimeWebinarOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const title = webinarTitle || webinars.find(webinar => webinar.id === webinarId)?.title;
  const options = webinarId && title && !webinars.some(webinar => webinar.id === webinarId)
    ? [{ id: webinarId, title }, ...webinars]
    : webinars;

  function switchWebinar(id: string) {
    if (pending || id === webinarId || !options.some(webinar => webinar.id === id)) return;
    const query = searchParams.toString();
    startTransition(() => {
      router.push(`/dashboard/webinars/${encodeURIComponent(id)}/realtime-v5${query ? `?${query}` : ""}`, { scroll: false });
    });
  }

  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb" aria-busy={pending}>
      <ol>
        <li><Link href="/dashboard/webinars">Webinars</Link></li>
        {title && (
          <li className={styles.breadcrumbWebinar}>
            <ChevronRight aria-hidden="true" />
            {webinarId ? (
              <Select value={webinarId} onValueChange={switchWebinar} disabled={pending || options.length < 2}>
                <SelectTrigger className={styles.webinarTrigger} aria-label="Select webinar" title={title}>
                  <SelectValue>{title}</SelectValue>
                </SelectTrigger>
                <SelectContent className={styles.webinarMenu} align="start">
                  {options.map(webinar => (
                    <SelectItem key={webinar.id} value={webinar.id} textValue={webinar.title} className={styles.webinarOption}>
                      <span className={styles.webinarOptionTitle} title={webinar.title}>{webinar.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <span title={title}>{title}</span>}
          </li>
        )}
        <li aria-current="page"><ChevronRight aria-hidden="true" /><span>Realtime</span></li>
      </ol>
      <span className="sr-only" aria-live="polite">{pending ? "Switching webinar…" : ""}</span>
    </nav>
  );
}
