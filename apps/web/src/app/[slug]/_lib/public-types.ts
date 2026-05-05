import type { PublicLead, PublicVideo, PublicWebinar } from "@/lib/public-dto";

export interface PlayerCta {
  id: string;
  label: string;
  url: string;
  showAtSec: number;
  hideAtSec: number | null;
}

export interface PlayerOwnerMsg {
  id: string;
  authorName: string;
  text: string;
  showAtSec: number;
  isOwner: boolean;
}

export interface PlayerLeadMsg {
  id: string;
  text: string;
  videoSec: number | null;
  createdAt: string;
}

export interface PlayerShellProps {
  webinar: PublicWebinar;
  video: PublicVideo | null;
  ctas: PlayerCta[];
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  lead: PublicLead;
  initialOffsetSec: number;
}
