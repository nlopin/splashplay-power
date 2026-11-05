import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildWebMcpData } from "@/services/agentTools/webmcpData";

import { buildBookingPageUrl, buildSiteTools, findFaqEntry } from "./siteTools";
import type { WebMcpTool } from "./types";

function setup(pathname = "/en", search = "") {
  const navigate = vi.fn();
  const tools = buildSiteTools({
    lang: "en",
    loadData: async () => buildWebMcpData("en"),
    location: { pathname, search },
    navigate,
  });
  const byName = (name: string) =>
    tools.find((t) => t.name === name) as WebMcpTool;
  const run = (name: string, input: Record<string, unknown> = {}) =>
    Promise.resolve(byName(name).execute(input, {}));
  return { tools, navigate, run };
}

// ts-reset types JSON.parse as unknown; tests know the shape.
const parse = (text: string) => JSON.parse(text) as any;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("site tools", () => {
  it("registers three tools with names within 30 characters", () => {
    const { tools } = setup();
    expect(tools.map((t) => t.name)).toEqual([
      "list_experiences",
      "get_faq",
      "open_booking_page",
    ]);
    for (const tool of tools) {
      expect(tool.name.length).toBeLessThanOrEqual(30);
      expect(tool.description.length).toBeLessThanOrEqual(500);
    }
  });

  it("list_experiences returns the compact catalog with contact details", async () => {
    const { run } = setup();
    const output = parse(await run("list_experiences"));
    expect(
      output.experiences.map((e: { experience: string }) => e.experience),
    ).toContain("open_session");
    expect(output.contact).toContain("info@splashplay.es");
  });

  it("get_faq lists questions, then answers one", async () => {
    const { run } = setup();
    const list = parse(await run("get_faq"));
    expect(list.questions.length).toBeGreaterThan(0);

    const answer = parse(await run("get_faq", { question: list.questions[0] }));
    expect(answer.question).toBe(list.questions[0]);
    expect(answer.answer).toBeTruthy();
  });

  it("get_faq explains when nothing matches", async () => {
    const { run } = setup();
    expect(await run("get_faq", { question: "zzz qqq" })).toContain("get_faq");
  });
});

describe("open_booking_page", () => {
  it("navigates to the localized page, keeping the partner and passing the date", async () => {
    const { run, navigate } = setup("/en", "?partner=acme&utm=x");
    const output = await run("open_booking_page", {
      experience: "family",
      date: "2026-11-01",
      guests: 4,
    });
    vi.runAllTimers();

    expect(output).toContain("Opening");
    expect(navigate).toHaveBeenCalledWith(
      "/en/book/family?partner=acme&date=2026-11-01",
    );
  });

  it("rejects a group too big for the experience without navigating", async () => {
    const { run, navigate } = setup();
    const output = await run("open_booking_page", {
      experience: "friends",
      guests: 8,
    });
    vi.runAllTimers();

    expect(output).toContain("1–6");
    expect(output).toContain("WhatsApp");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains couples are exactly two people", async () => {
    const { run } = setup();
    expect(
      await run("open_booking_page", { experience: "couples", guests: 3 }),
    ).toContain("exactly 2");
  });

  it("does not offer individual sessions", async () => {
    const { run, navigate } = setup();
    const output = await run("open_booking_page", { experience: "individual" });
    vi.runAllTimers();
    expect(output).toContain("open_session");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends team building to contact", async () => {
    const { run } = setup();
    const output = await run("open_booking_page", {
      experience: "teambuilding",
    });
    expect(output).toContain("can't be booked online");
    expect(output).toContain("info@splashplay.es");
  });

  it("doesn't reload when already on that booking page", async () => {
    const { run, navigate } = setup("/en/book/friends/");
    const output = await run("open_booking_page", { experience: "friends" });
    vi.runAllTimers();
    expect(output).toContain("already");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const { run, navigate } = setup();
    const output = await run("open_booking_page", {
      experience: "friends",
      date: "next sunday",
    });
    vi.runAllTimers();
    expect(output).toContain("YYYY-MM-DD");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("buildBookingPageUrl drops unrelated params", () => {
    expect(buildBookingPageUrl("/book/couples", "?utm=1")).toBe(
      "/book/couples",
    );
  });

  it("findFaqEntry matches by shared words, ignoring accents and case", () => {
    const faq = [
      { question: "¿Dónde está el estudio?", answer: "A" },
      { question: "¿Qué ropa llevar?", answer: "B" },
    ];
    expect(findFaqEntry(faq, "donde esta el estudio")?.answer).toBe("A");
    expect(findFaqEntry(faq, "ropa")?.answer).toBe("B");
    expect(findFaqEntry(faq, "")).toBeUndefined();
  });
});
