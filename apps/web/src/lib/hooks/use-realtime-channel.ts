"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RealtimeEvent, RealtimeScope, RealtimeStatus } from "@/lib/realtime-protocol";

type Listener = {
  status: (status: RealtimeStatus) => void;
  event: (event: RealtimeEvent) => void;
  resync: () => void;
};
type Channel = {
  socket: Socket;
  status: RealtimeStatus;
  listeners: Set<Listener>;
  dispose?: ReturnType<typeof setTimeout>;
  retry?: ReturnType<typeof setTimeout>;
};

// Chat and player presence share one connection for the same browser identity.
const channels = new Map<string, Channel>();

function acquire(scope: RealtimeScope, key: string): Channel {
  const existing = channels.get(key);
  if (existing) {
    clearTimeout(existing.dispose);
    return existing;
  }
  const socket = io({
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    auth: { scope },
    autoConnect: false,
    timeout: 8_000,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5
  });
  const channel: Channel = { socket, status: "connecting", listeners: new Set() };
  let revoked = false;
  let attempts = 0;
  channels.set(key, channel);
  const updateStatus = (status: RealtimeStatus) => {
    channel.status = status;
    channel.listeners.forEach((listener) => listener.status(status));
  };
  socket.on("connect", () => {
    clearTimeout(channel.retry);
    attempts = 0;
    revoked = false;
    updateStatus("connected");
    channel.listeners.forEach((listener) => listener.resync());
  });
  socket.on("disconnect", (reason: string) => {
    updateStatus(revoked ? "fallback" : "reconnecting");
    // Server-side disconnects (expired session / Redis recovery) don't trigger
    // Socket.IO's automatic retry. A fresh handshake must recheck permissions.
    if (!revoked && reason === "io server disconnect") socket.connect();
  });
  socket.on("connect_error", (error: Error) => {
    revoked = error?.message === "unauthorized";
    updateStatus("fallback");
    clearTimeout(channel.retry);
    // Middleware failures disable Socket.IO's transport-level autoreconnect.
    if (!revoked && !socket.active) {
      channel.retry = setTimeout(() => {
        if (channel.listeners.size && !socket.connected) socket.connect();
      }, Math.min(1_000 * 2 ** attempts++, 10_000));
    }
  });
  socket.on("realtime:unauthorized", () => { revoked = true; updateStatus("fallback"); });
  socket.on("realtime:unavailable", () => updateStatus("fallback"));
  socket.on("realtime:event", (event: RealtimeEvent) => {
    if (event.type === "resync") {
      updateStatus("connected");
      channel.listeners.forEach((listener) => listener.resync());
    } else {
      channel.listeners.forEach((listener) => listener.event(event));
    }
  });
  socket.connect();
  return channel;
}

export function useRealtimeChannel(
  scope: RealtimeScope,
  onEvent: (event: RealtimeEvent) => void,
  onResync: () => void
) {
  const callbacks = useRef({ onEvent, onResync });
  callbacks.current = { onEvent, onResync };
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const channelRef = useRef<Channel | null>(null);
  const kind = scope.kind;
  const webinarId = scope.kind === "webinar" ? scope.webinarId : undefined;
  const clientKey = scope.kind === "lead" ? scope.clientKey : undefined;

  useEffect(() => {
    const currentScope: RealtimeScope = kind === "webinar" ? { kind, webinarId: webinarId! } : { kind };
    const key = `${kind}:${webinarId ?? clientKey ?? ""}`;
    const channel = acquire(currentScope, key);
    channelRef.current = channel;
    const listener: Listener = {
      status: setStatus,
      event: (event) => callbacks.current.onEvent(event),
      resync: () => callbacks.current.onResync()
    };
    channel.listeners.add(listener);
    setStatus(channel.status);
    if (channel.status === "connected") listener.resync();

    const onFocus = () => {
      if (document.hidden) return;
      if (!channel.socket.connected) channel.socket.connect();
      else listener.resync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      channelRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      channel.listeners.delete(listener);
      if (!channel.listeners.size) {
        channel.dispose = setTimeout(() => {
          clearTimeout(channel.retry);
          channel.socket.removeAllListeners();
          channel.socket.disconnect();
          channels.delete(key);
        }, 100);
      }
    };
  }, [kind, webinarId, clientKey]);

  const emitPresence = useCallback((playing: boolean) => {
    const channel = channelRef.current;
    // Never buffer old "playing" signals while offline.
    if (channel?.socket.connected) channel.socket.volatile.emit("presence:heartbeat", { playing });
  }, []);

  return { status, emitPresence };
}
