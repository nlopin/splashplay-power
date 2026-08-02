import { describe, it, expect } from "vitest";
import { GET } from "./event-types";

function makeUrl(params: Record<string, string> = {}): URL {
  const url = new URL("http://localhost/api/v1/event-types");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

describe("GET /api/v1/event-types", () => {
  it("returns all event types with keys, labels, and option schemas", async () => {
    const response = await GET({ url: makeUrl() } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;

    expect(body.eventTypes).toHaveLength(4);
    const keys = body.eventTypes.map((e: any) => e.key);
    expect(keys).toEqual(["couples", "family", "friends", "individual"]);

    const family = body.eventTypes.find((e: any) => e.key === "family");
    expect(typeof family.label).toBe("string");
    expect(family.label.length).toBeGreaterThan(0);
    expect(family.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "canvasType", type: "enum" }),
      ]),
    );

    const individual = body.eventTypes.find((e: any) => e.key === "individual");
    expect(individual.options).toEqual([]);
  });

  it("resolves labels for a supported lang param", async () => {
    const response = await GET({ url: makeUrl({ lang: "en" }) } as any);
    const body = (await response.json()) as any;
    const individual = body.eventTypes.find((e: any) => e.key === "individual");
    expect(typeof individual.label).toBe("string");
  });
});
