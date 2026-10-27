import { describe, expect, it } from "vitest";

import { getPageTranslations, languages } from "@/utils/i18n";
import { MAX_TOOL_OUTPUT_CHARS } from "@/webmcp/register";

import { buildWebMcpData } from "./webmcpData";

describe("buildWebMcpData", () => {
  it.each(languages)("%s: exposes open sessions but not individual", (lang) => {
    const data = buildWebMcpData(lang);
    const ids = data.experiences.map((e) => e.experience);

    expect(ids).toContain("open_session");
    expect(ids).not.toContain("individual");
    expect(
      data.experiences.find((e) => e.experience === "teambuilding"),
    ).toMatchObject({
      bookOnline: false,
    });
    expect(Object.keys(data.bookingPaths)).toEqual([
      "couples",
      "family",
      "friends",
      "open_session",
    ]);
  });

  it("builds localized booking paths", () => {
    expect(buildWebMcpData("es").bookingPaths.open_session).toBe(
      "/book/open-session",
    );
    expect(buildWebMcpData("en").bookingPaths.couples).toBe("/en/book/couples");
  });

  // list_experiences and get_faq return these as-is, so each must fit the
  // WebMCP output budget in every language.
  it.each(languages)(
    "%s: list_experiences and the FAQ question list fit the budget",
    (lang) => {
      const data = buildWebMcpData(lang);
      const experiencesOutput = JSON.stringify({
        experiences: data.experiences,
        contact: "x".repeat(120),
      });
      const questionsOutput = JSON.stringify({
        questions: data.faq.map((entry) => entry.question),
        location: data.location,
      });

      expect(experiencesOutput.length).toBeLessThanOrEqual(
        MAX_TOOL_OUTPUT_CHARS,
      );
      expect(questionsOutput.length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_CHARS);
      for (const entry of data.faq) {
        expect(JSON.stringify(entry).length).toBeLessThanOrEqual(
          MAX_TOOL_OUTPUT_CHARS,
        );
      }
    },
  );
});

describe("webmcp locale strings", () => {
  const reference = Object.keys(getPageTranslations("es", "webmcp")).sort();

  it.each(languages)("%s has every webmcp key", (lang) => {
    const messages = getPageTranslations(lang, "webmcp");
    expect(Object.keys(messages).sort()).toEqual(reference);
    for (const value of Object.values(messages)) {
      expect(value).toBeTruthy();
    }
  });

  it.each(languages)("%s keeps the same placeholders as Spanish", (lang) => {
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();
    const es = getPageTranslations("es", "webmcp");
    const messages = getPageTranslations(lang, "webmcp");
    for (const key of reference) {
      expect(placeholders(messages[key as keyof typeof messages])).toEqual(
        placeholders(es[key as keyof typeof es]),
      );
    }
  });
});
