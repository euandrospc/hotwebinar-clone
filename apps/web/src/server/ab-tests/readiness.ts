import type { Video, Webinar } from "db";
import type { AbMetric } from "@/lib/ab-tests";

type ReadinessWebinar = Pick<Webinar, "pitchAtSec" | "offerDisabled" | "offerLink" | "offerShowAtSec" | "offerHideAtSec"> & {
  video: Pick<Video, "status" | "hlsUrl" | "durationSec"> | null;
};

/** Configuration checks only; passing does not certify playback or purchase webhooks. */
export function abReadinessIssues(webinar: ReadinessWebinar, metric: AbMetric): string[] {
  const issues: string[] = [];
  const video = webinar.video;
  if (!video || video.status !== "READY" || !video.hlsUrl?.trim()) issues.push("vincule um vídeo pronto para reprodução");
  const duration = video?.durationSec && video.durationSec > 0 ? video.durationSec : null;
  if (metric === "PITCH_REACHED") {
    if (webinar.pitchAtSec === null || !Number.isFinite(webinar.pitchAtSec) || webinar.pitchAtSec < 0) issues.push("configure o momento do pitch");
    else if (duration !== null && webinar.pitchAtSec >= duration) issues.push("posicione o pitch antes do fim do vídeo");
  }
  if (metric === "OFFER_CLICK") {
    if (webinar.offerDisabled) issues.push("ative a oferta para medir cliques");
    let validLink = false;
    try { const url = new URL(webinar.offerLink ?? ""); validLink = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { /* Report an actionable configuration issue. */ }
    if (!validLink) issues.push("configure um link HTTP ou HTTPS válido para a oferta");
    const show = webinar.offerShowAtSec ?? 0;
    if (show < 0 || (duration !== null && show >= duration)) issues.push("posicione a oferta antes do fim do vídeo");
    if (webinar.offerHideAtSec !== null && webinar.offerHideAtSec <= show) issues.push("ajuste o fim da oferta para depois de sua exibição");
  }
  return issues;
}
