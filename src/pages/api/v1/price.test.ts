import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScheduleSlot } from "@/services/availability/schedule";

vi.mock("@/services/availability/schedule", () => ({
  getScheduleSlot: vi.fn(),
}));

const { GET } = await import("./price");

const DATETIME = "2026-08-10T14:00:00.000Z";

function makeUrl(params: Record<string, string> = {}): URL {
  const url = new URL("http://localhost/api/v1/price");
  url.searchParams.set("datetime", DATETIME);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

describe("GET /api/v1/price", () => {
  beforeEach(() => {
    vi.mocked(getScheduleSlot).mockReset();
    vi.mocked(getScheduleSlot).mockReturnValue({ discount: undefined });
  });

  it("rejects a missing/invalid eventType", async () => {
    const response = await GET({ url: makeUrl({ eventType: "bogus" }) } as any);
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.eventTypes).toEqual(["couples", "family", "friends", "individual"]);
  });

  it("rejects a malformed datetime", async () => {
    const url = new URL("http://localhost/api/v1/price");
    url.searchParams.set("eventType", "individual");
    url.searchParams.set("datetime", "not-a-date");
    const response = await GET({ url } as any);
    expect(response.status).toBe(400);
  });

  it("rejects a datetime that isn't a real schedule slot", async () => {
    vi.mocked(getScheduleSlot).mockReturnValue(undefined);
    const response = await GET(
      { url: makeUrl({ eventType: "individual" }) } as any,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.error).toMatch(/schedule slot/i);
  });

  it("prices individual with no discount", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "individual" }) } as any,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      price: 6000,
      eventType: "individual",
      datetime: DATETIME,
    });
  });

  it("applies the slot discount", async () => {
    vi.mocked(getScheduleSlot).mockReturnValue({ discount: 10 });
    const response = await GET(
      { url: makeUrl({ eventType: "individual" }) } as any,
    );
    const body = (await response.json()) as any;
    expect(body.price).toBe(5400); // Math.round(6000 * 0.9)
  });

  it("defaults family options when none are passed", async () => {
    const response = await GET({ url: makeUrl({ eventType: "family" }) } as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      price: 12000,
      eventType: "family",
      datetime: DATETIME,
      adults: 2,
      kids: 1,
      canvases: 3,
      canvasType: "standard",
      activityFormat: "splash",
    });
  });

  it("rejects canvasType=big with activityFormat=pouring for family", async () => {
    const response = await GET(
      {
        url: makeUrl({
          eventType: "family",
          canvasType: "big",
          activityFormat: "pouring",
        }),
      } as any,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.error).toMatch(/splash/i);
  });

  it("rejects pictureType=one_big with activityFormat=pouring for couples", async () => {
    const response = await GET(
      {
        url: makeUrl({
          eventType: "couples",
          pictureType: "one_big",
          activityFormat: "pouring",
        }),
      } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unknown enum value", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "family", canvasType: "huge" }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a negative number option", async () => {
    const response = await GET(
      { url: makeUrl({ eventType: "family", adults: "-1" }) } as any,
    );
    expect(response.status).toBe(400);
  });

  it("prices friends with explicit options", async () => {
    const response = await GET(
      {
        url: makeUrl({
          eventType: "friends",
          guests: "4",
          canvases: "3",
          canvasType: "standard",
        }),
      } as any,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.price).toBe(12800);
    expect(body.guests).toBe(4);
    expect(body.canvases).toBe(3);
  });
});
