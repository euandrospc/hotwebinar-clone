import { describe, it, expect } from "vitest";
import { normalizePath, guessEntityName } from "../../src/stages/04-analyze.js";

describe("normalizePath", () => {
  it("replaces numeric ids", () => {
    expect(normalizePath("https://x/api/webinars/42")).toBe("/api/webinars/:id");
  });
  it("replaces UUID v4 ids", () => {
    expect(normalizePath("https://x/api/leads/123e4567-e89b-12d3-a456-426614174000")).toBe("/api/leads/:id");
  });
  it("replaces long alphanumeric ids", () => {
    expect(normalizePath("https://x/api/items/clx123abcdef456gh")).toBe("/api/items/:id");
  });
  it("strips trailing slash", () => {
    expect(normalizePath("https://x/api/users/")).toBe("/api/users");
  });
  it("returns / for root", () => {
    expect(normalizePath("https://x/")).toBe("/");
  });
  it("leaves short word segments alone", () => {
    expect(normalizePath("https://x/api/users/me")).toBe("/api/users/me");
  });
});

describe("guessEntityName", () => {
  it("singularizes -ies", () => {
    expect(guessEntityName("/api/categories/:id")).toBe("Category");
    expect(guessEntityName("/api/properties/:id")).toBe("Property");
  });
  it("strips -es from -ses/-xes/-zes/-ches/-shes", () => {
    expect(guessEntityName("/api/statuses/:id")).toBe("Status");
    expect(guessEntityName("/api/boxes/:id")).toBe("Box");
    expect(guessEntityName("/api/classes/:id")).toBe("Class");
  });
  it("strips trailing -s but not -ss", () => {
    expect(guessEntityName("/api/webinars/:id")).toBe("Webinar");
    expect(guessEntityName("/api/access/:id")).toBe("Access");
  });
  it("leaves irregulars alone", () => {
    expect(guessEntityName("/api/news")).toBe("News");
    expect(guessEntityName("/api/media")).toBe("Media");
  });
  it("skips api and version segments", () => {
    expect(guessEntityName("/api/v2/leads/:id")).toBe("Lead");
  });
  it("returns null when nothing nameable", () => {
    expect(guessEntityName("/api/v1/:id")).toBeNull();
  });
});
