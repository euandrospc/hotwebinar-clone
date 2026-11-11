import { describe, expect, it } from "vitest";
import { createChatIntelligenceDemo } from "@/lib/dashboard-chat-intelligence-demo";
import { OBJECTION_CATEGORIES, QUESTION_CATEGORIES } from "@/lib/dashboard-chat-intelligence";

const input = {
  webinarId: "demo-webinar", totalMessages: 1382, uniqueConversations: 431,
  from: new Date("2026-11-05T03:00:00Z"), to: new Date("2026-11-12T02:59:59.999Z")
};

describe("chat intelligence demo", () => {
  it.each([0, 1, 10, 1382, 100000])("keeps evidence and counts consistent for %i messages", (totalMessages) => {
    const report = createChatIntelligenceDemo({ ...input, totalMessages, uniqueConversations: Math.min(totalMessages, input.uniqueConversations) });
    expect(report.analyzedMessages).toBe(totalMessages);
    expect(report.pendingMessages).toBe(0);
    expect(report.objectionMessages).toBeLessThanOrEqual(totalMessages);
    expect(report.questionMessages).toBeLessThanOrEqual(totalMessages);
    expect(report.objectionMessages + report.questionMessages + report.neutralMessages).toBeGreaterThanOrEqual(totalMessages);
    for (const [kind, categories, base, catalog] of [
      ["objections", report.objections, report.objectionMessages, OBJECTION_CATEGORIES],
      ["questions", report.questions, report.questionMessages, QUESTION_CATEGORIES]
    ] as const) {
      expect(categories.reduce((sum, row) => sum + row.messageCount, 0)).toBeGreaterThanOrEqual(base);
      for (const category of categories) {
        expect(catalog.some((entry) => entry.id === category.id)).toBe(true);
        expect(category.messageCount).toBeGreaterThan(0);
        expect(category.conversationCount).toBeLessThanOrEqual(category.messageCount);
        expect(category.conversationCount).toBeLessThanOrEqual(input.uniqueConversations);
        expect(category.examples.length).toBeLessThanOrEqual(category.messageCount);
        expect(category.examples.length).toBeLessThanOrEqual(5);
        expect(category.percentage).toBeCloseTo(category.messageCount / base * 100, 2);
        for (const example of category.examples) {
          expect(example.text).not.toBe("");
          expect(new Date(example.createdAt).getTime()).toBeGreaterThanOrEqual(input.from.getTime());
          expect(new Date(example.createdAt).getTime()).toBeLessThanOrEqual(input.to.getTime());
        }
      }
      if (!totalMessages) expect(report[kind]).toEqual([]);
    }
  });

  it("is deterministic and preserves literal examples shared by both tables", () => {
    const report = createChatIntelligenceDemo(input);
    expect(createChatIntelligenceDemo(input)).toEqual(report);
    const objections = report.objections.flatMap((row) => row.examples);
    const questions = report.questions.flatMap((row) => row.examples);
    const overlap = objections.find((example) => questions.some((question) => question.id === example.id));
    expect(overlap).toBeDefined();
    expect(questions.find((question) => question.id === overlap!.id)).toEqual(overlap);
  });

  it("rejects invalid inputs", () => {
    expect(() => createChatIntelligenceDemo({ ...input, totalMessages: -1 })).toThrow(RangeError);
    expect(() => createChatIntelligenceDemo({ ...input, from: input.to, to: input.from })).toThrow(RangeError);
  });
});
