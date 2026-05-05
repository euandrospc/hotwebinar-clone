import type { PublicVideo, PublicWebinar, PublicLeadWithUtms } from "@/lib/public-dto";

export interface PlayerOffer {
  name: string;
  title: string;
  priceOriginal: string | null;
  priceFinal: string | null;
  buttonText: string;
  buttonColor: string;
  imageDesktopUrl: string | null;
  imageMobileUrl: string | null;
  showAtSec: number | null;
  hideAtSec: number | null;
  link: string | null;
  passUtms: boolean;
  disabled: boolean;
  sameWindow: boolean;
  raffleEnabled: boolean;
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
  offer: PlayerOffer;
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  lead: PublicLeadWithUtms;
  initialOffsetSec: number;
}
