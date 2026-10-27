import { describe, expect, it } from "vitest";

import { formatWeek } from "./formatters";

const monday = new Date(Date.UTC(2026, 9, 26));
const sunday = new Date(Date.UTC(2026, 10, 1));

describe("formatWeek", () => {
  it.each([
    ["es", "26 de octubre–1 de noviembre"],
    ["en", "October 26–November 1"],
    ["fr", "26 octobre–1 novembre"],
  ])("%s: closes up the en dash in a range", (locale, expected) => {
    expect(formatWeek(monday, sunday, locale)).toBe(expected);
  });

  it("leaves no spaces next to the dash in any locale", () => {
    for (const locale of ["es", "en", "ca", "fr"]) {
      expect(formatWeek(monday, sunday, locale)).not.toMatch(
        /\s\u2013|\u2013\s/,
      );
    }
  });

  it("keeps a range within one month compact", () => {
    expect(
      formatWeek(
        new Date(Date.UTC(2026, 10, 2)),
        new Date(Date.UTC(2026, 10, 8)),
        "es",
      ),
    ).toBe("2–8 de noviembre");
  });
});
