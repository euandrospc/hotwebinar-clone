import { vi, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest with testing-library matchers
expect.extend(matchers);

// Mock hasPointerCapture for radix-ui components in jsdom
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}

// Mock ResizeObserver for recharts ResponsiveContainer in jsdom.
// Immediately invoke the callback with synthetic dimensions so charts render.
class ResizeObserverMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private cb: any) {}
  observe(target: Element) {
    this.cb(
      [
        {
          target,
          contentRect: { width: 400, height: 240, top: 0, left: 0, bottom: 240, right: 400, x: 0, y: 0 }
        }
      ],
      this
    );
  }
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ResizeObserver = ResizeObserverMock as any;
}
