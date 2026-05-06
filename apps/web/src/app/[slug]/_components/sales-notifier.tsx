"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PublicSaleNotification } from "@/lib/public-dto";

interface Props {
  notifications: PublicSaleNotification[];
  currentTimeRef: React.RefObject<number>;
}

export function SalesNotifier({ notifications, currentTimeRef }: Props) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => {
      const t = currentTimeRef.current ?? 0;
      for (const n of notifications) {
        if (firedRef.current.has(n.id)) continue;
        if (t >= n.showAtSec) {
          firedRef.current.add(n.id);
          const msg = !n.productName
            ? `🛒 ${n.buyerName}`
            : n.price
              ? `🛒 ${n.buyerName} comprou ${n.productName} por ${n.price}`
              : `🛒 ${n.buyerName} comprou ${n.productName}`;
          toast.success(msg, { duration: 6000 });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [notifications, currentTimeRef]);

  return null;
}
