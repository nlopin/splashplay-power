import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailability } from "@/services/availability";
import { formatBusinessDate } from "@/services/availability/schedule";
import { addDay } from "@/utils/datetime";

vi.mock("@/services/availability", () => ({
  getAvailability: vi.fn(),
}));

const { GET } = await import("./check");

function makeUrl(params: Record<string, string> = {}): URL {
  const url = new URL("http://localhost/api/v1/bookings/check");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

describe("GET /api/v1/bookings/check", () => {
  beforeEach(() => {
    vi.mocked(getAvailability).mockReset();
  });

  it("returns only open slots for the requested day", async () => {
    const today = formatBusinessDate(new Date());
    vi.mocked(getAvailability).mockResolvedValue([
      { time: `${today}T14:00:00.000Z` },
      { time: `${today}T16:00:00.000Z`, booked: true },
    ] as any);

    const response = await GET(
      { url: makeUrl({ eventType: "family", date: today }) } as any,
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      eventType: "family",
      date: today,
      slots: [{ time: `${today}T14:00:00.000Z` }],
    });
  });

  it("rejects a missing eventType", async () => {
    const response = await GET({ url: makeUrl({ date: "2026-08-10" }) } as any);
    expect(response.status).toBe(400);
  });

  it("rejects a malformed date", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "individual", date: "08/10/2026" }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a date before today", async () => {
    const yesterday = formatBusinessDate(addDay(new Date(), -1));
    const response = await GET(
      { url: makeUrl({ eventType: "individual", date: yesterday }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a date beyond the 30-day cap", async () => {
    const tooFar = formatBusinessDate(addDay(new Date(), 31));
    const response = await GET(
      { url: makeUrl({ eventType: "individual", date: tooFar }) } as any,
    );
    expect(response.status).toBe(400);
  });
});
