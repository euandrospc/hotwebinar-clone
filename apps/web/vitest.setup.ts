import { vi, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest with testing-library matchers
expect.extend(matchers);

// Mock hasPointerCapture for radix-ui components in jsdom
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
