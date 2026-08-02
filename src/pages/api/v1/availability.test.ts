import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailability } from "@/services/availability";

vi.mock("@/services/availability", () => ({
  getAvailability: vi.fn(),
}));

const { GET } = await import("./availability");

function makeUrl(params: Record<string, string> = {}): URL {
  const url = new URL("http://localhost/api/v1/availability");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

describe("GET /api/v1/availability", () => {
  beforeEach(() => {
    vi.mocked(getAvailability).mockReset();
  });

  it("returns only open slots, defaulting to 7 days", async () => {
    vi.mocked(getAvailability).mockResolvedValue([
      { time: "2026-08-10T14:00:00.000Z" },
      { time: "2026-08-10T16:00:00.000Z", booked: true },
    ] as any);

    const response = await GET({ url: makeUrl({ eventType: "family" }) } as any);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(getAvailability).toHaveBeenCalledWith("family", 7);
    expect(body).toEqual({
      eventType: "family",
      days: 7,
      slots: [{ time: "2026-08-10T14:00:00.000Z" }],
    });
  });

  it("honors a valid days param", async () => {
    vi.mocked(getAvailability).mockResolvedValue([]);
    const response = await GET(
      { url: makeUrl({ eventType: "individual", days: "30" }) } as any,
    );
    expect(response.status).toBe(200);
    expect(getAvailability).toHaveBeenCalledWith("individual", 30);
  });

  it("rejects a missing eventType", async () => {
    const response = await GET({ url: makeUrl() } as any);
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.error).toMatch(/eventType/i);
    expect(body.eventTypes).toEqual(["couples", "family", "friends", "individual"]);
  });

  it("rejects an invalid eventType", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "not_a_real_type" }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects days over the 30-day cap", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "individual", days: "31" }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a non-integer days param", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "individual", days: "abc" }) } as any,
    );
    expect(response.status).toBe(400);
  });
});
