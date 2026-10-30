import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";
import type { RealtimeEvent } from "@/lib/realtime-protocol";

const transport = vi.hoisted(() => {
  const sockets: Array<{
    connected: boolean;
    handlers: Map<string, (...args: any[]) => void>;
    on: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    volatile: { emit: ReturnType<typeof vi.fn> };
  }> = [];
  const io = vi.fn(() => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const socket = {
      connected: false, handlers,
      on: vi.fn((name: string, fn: (...args: any[]) => void) => handlers.set(name, fn)),
      connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn(),
      volatile: { emit: vi.fn() }
    };
    sockets.push(socket);
    return socket;
  });
  return { sockets, io };
});
vi.mock("socket.io-client", () => ({ io: transport.io }));

const onEvent = vi.fn();
const onResync = vi.fn();
function Consumer({ name = "first", callback = onEvent, clientKey }: { name?: string; callback?: (event: RealtimeEvent) => void; clientKey?: string }) {
  const { status, emitPresence } = useRealtimeChannel({ kind: "lead", clientKey }, callback, onResync);
  return <button onClick={() => emitPresence(true)}>{name}: {status}</button>;
}

beforeEach(() => { vi.useFakeTimers(); transport.io.mockClear(); transport.sockets.length = 0; onEvent.mockClear(); onResync.mockClear(); });
afterEach(() => { cleanup(); act(() => vi.advanceTimersByTime(100)); vi.useRealTimers(); });

describe("shared realtime channel", () => {
  it("opens a fresh authenticated channel when the lead identity changes", () => {
    const component = render(<Consumer clientKey="lead-a" />);
    component.rerender(<Consumer clientKey="lead-b" />);
    expect(transport.io).toHaveBeenCalledTimes(2);
    act(() => transport.sockets[0].handlers.get("realtime:event")!({ type: "presence", webinarId: "old" }));
    expect(onEvent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(transport.sockets[0].disconnect).toHaveBeenCalledOnce();
  });

  it("retries a transient middleware rejection without waiting for window focus", () => {
    render(<Consumer />);
    const socket = transport.sockets[0];
    const initialAttempts = socket.connect.mock.calls.length;
    act(() => socket.handlers.get("connect_error")!(new Error("unavailable")));
    act(() => vi.advanceTimersByTime(1_000));
    expect(socket.connect).toHaveBeenCalledTimes(initialAttempts + 1);
  });

  it("does not reconnect in a loop after the server revokes access", () => {
    render(<Consumer />);
    const socket = transport.sockets[0];
    const initialAttempts = socket.connect.mock.calls.length;
    act(() => {
      socket.handlers.get("realtime:unauthorized")!();
      socket.handlers.get("disconnect")!("io server disconnect");
    });
    expect(socket.connect).toHaveBeenCalledTimes(initialAttempts);
    expect(screen.getByText("first: fallback")).toBeInTheDocument();
  });

  it("shares the player connection and closes only after the last consumer leaves", () => {
    const first = render(<Consumer />);
    const second = render(<Consumer name="second" />);
    expect(transport.io).toHaveBeenCalledTimes(1);
    const socket = transport.sockets[0];
    act(() => { socket.connected = true; socket.handlers.get("connect")!(); });
    expect(screen.getByText("first: connected")).toBeInTheDocument();
    expect(screen.getByText("second: connected")).toBeInTheDocument();
    first.unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(socket.disconnect).not.toHaveBeenCalled();
    second.unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("recovers from Redis/socket failures and requests a fresh history on recovery", () => {
    render(<Consumer />);
    const socket = transport.sockets[0];
    act(() => socket.handlers.get("connect_error")!());
    expect(screen.getByText("first: fallback")).toBeInTheDocument();
    act(() => { socket.connected = true; socket.handlers.get("connect")!(); });
    expect(onResync).toHaveBeenCalledTimes(1);
    act(() => socket.handlers.get("realtime:unavailable")!());
    expect(screen.getByText("first: fallback")).toBeInTheDocument();
    act(() => socket.handlers.get("realtime:event")!({ type: "resync" }));
    expect(screen.getByText("first: connected")).toBeInTheDocument();
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callback without reconnecting and never buffers offline presence", () => {
    const component = render(<Consumer />);
    const socket = transport.sockets[0];
    fireEvent.click(screen.getByRole("button"));
    expect(socket.volatile.emit).not.toHaveBeenCalled();
    const latest = vi.fn();
    component.rerender(<Consumer callback={latest} />);
    act(() => { socket.connected = true; socket.handlers.get("connect")!(); socket.handlers.get("realtime:event")!({ type: "presence", webinarId: "w1" }); });
    fireEvent.click(screen.getByRole("button"));
    expect(socket.volatile.emit).toHaveBeenCalledWith("presence:heartbeat", { playing: true });
    expect(transport.io).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
