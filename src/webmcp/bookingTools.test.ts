import { describe, expect, it, vi } from "vitest";

import type { Availability, PricingData } from "@/components/booking/types";
import { applyFamilyPatch } from "@/components/booking/eventTypeOptions/formState";
import type { WebMcpEventType } from "@/services/agentTools/eventTypes";
import { buildWebMcpData } from "@/services/agentTools/webmcpData";
import { formatPrice } from "@/utils/price";

import {
  buildBookingTools,
  type BookingToolsContext,
  type PaymentResult,
} from "./bookingTools";
import type { WebMcpTool } from "./types";

// ts-reset types JSON.parse as unknown; tests know the shape.
const parse = (text: string) => JSON.parse(text) as any;

const NOW = new Date("2026-10-27T09:00:00Z");

// Barcelona is UTC+1 in November.
const availability: Availability = [
  { time: "2026-10-26T10:00:00.000Z" }, // past
  { time: "2026-11-01T10:00:00.000Z" }, // Sun 11:00
  { time: "2026-11-01T14:00:00.000Z", discount: 15 }, // Sun 15:00
  { time: "2026-11-01T17:30:00.000Z", booked: true }, // Sun 18:30, booked
  { time: "2026-11-02T17:30:00.000Z" }, // Mon 18:30
];

const familyPricing: PricingData = {
  amount: 6000,
  guests: 3,
  selection: {
    eventType: "family",
    adults: 2,
    kids: 1,
    canvases: 3,
    canvasType: "standard",
    activityFormat: "splash",
  },
};

function setup(overrides: Partial<BookingToolsContext> = {}) {
  const ctx: BookingToolsContext = {
    eventType: "family",
    lang: "en",
    availability,
    selectedTimeSlot: null,
    pricing: familyPricing,
    isLoading: false,
    now: () => NOW,
    themeName: () => undefined,
    selectTimeSlot: vi.fn(),
    applyOptions: vi.fn((patch) => {
      const { adjusted } = applyFamilyPatch(
        {
          adults: 2,
          kids: 1,
          canvases: 3,
          canvasType: "standard",
          activityFormat: "splash",
        },
        patch,
      );
      return { data: familyPricing, adjusted };
    }),
    startPayment: vi.fn(async (): Promise<PaymentResult> => ({
      ok: true,
      amountCents: 5100,
    })),
    loadData: async () => buildWebMcpData("en"),
    ...overrides,
  };
  const tools = buildBookingTools(ctx);
  const run = async (name: string, input: Record<string, unknown> = {}) =>
    (tools.find((t) => t.name === name) as WebMcpTool).execute(input, {});
  return { ctx, tools, run };
}

describe("booking tools", () => {
  it("exposes five tools within the WebMCP limits", () => {
    const { tools } = setup();
    expect(tools.map((t) => [t.name, t.annotations ?? {}])).toEqual([
      ["find_open_slots", { readOnlyHint: true }],
      ["select_time_slot", {}],
      ["set_booking_options", {}],
      ["get_booking_summary", { readOnlyHint: true }],
      ["start_payment", { consequentialHint: true }],
    ]);
    for (const tool of tools) {
      expect(tool.name.length).toBeLessThanOrEqual(30);
      expect(tool.description.length).toBeLessThanOrEqual(500);
    }
  });

  it.each<[WebMcpEventType, string[]]>([
    ["couples", ["activityFormat", "picture"]],
    ["family", ["adults", "kids", "activityFormat", "canvasType", "canvases"]],
    ["friends", ["guests", "activityFormat", "canvasType", "canvases"]],
    ["open_session", ["solo", "pair_shared", "pair_two"]],
  ])("set_booking_options takes the %s fields", (eventType, fields) => {
    const { tools } = setup({ eventType });
    const schema = tools.find((t) => t.name === "set_booking_options")!
      .inputSchema as { properties: Record<string, unknown>; $schema?: string };
    expect(Object.keys(schema.properties)).toEqual(fields);
    expect(schema.$schema).toBeUndefined();
  });

  it("emits a plain schema the DevTools pane can render", () => {
    const { tools } = setup({ eventType: "family" });
    const schema = tools.find(
      (t) => t.name === "set_booking_options",
    )!.inputSchema;
    expect(schema).toEqual({
      type: "object",
      properties: {
        adults: expect.objectContaining({ type: "integer", minimum: 0 }),
        kids: expect.objectContaining({ type: "integer", minimum: 0 }),
        activityFormat: expect.objectContaining({
          type: "string",
          enum: ["splash", "pouring"],
        }),
        canvasType: expect.objectContaining({ enum: ["standard", "big"] }),
        canvases: expect.objectContaining({ type: "integer", minimum: 1 }),
      },
    });
    const text = JSON.stringify(schema);
    expect(text).not.toContain("additionalProperties");
    expect(text).not.toContain("exclusiveMinimum");
    expect(text).not.toContain(String(Number.MAX_SAFE_INTEGER));
  });
});

describe("find_open_slots", () => {
  it("lists future open slots with discounts", async () => {
    const { run } = setup();
    const { slots } = parse(await run("find_open_slots"));
    expect(slots.map((s: { datetime: string }) => s.datetime)).toEqual([
      "2026-11-01T10:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-02T17:30:00.000Z",
    ]);
    expect(slots[1]).toMatchObject({ discountPercent: 15 });
    expect(slots[0].label).toContain("November");
  });

  it("filters by day and time of day in Barcelona time", async () => {
    const { run } = setup();
    const { slots } = parse(
      await run("find_open_slots", {
        from: "2026-11-01",
        to: "2026-11-01",
        timeOfDay: "afternoon",
      }),
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].datetime).toBe("2026-11-01T14:00:00.000Z");
  });

  it("caps the list and says how many more match", async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 10, 1 + i, 10)).toISOString(),
    }));
    const { run } = setup({ availability: many });
    const output = await run("find_open_slots");
    const { slots, note } = parse(output);
    expect(slots).toHaveLength(10);
    expect(note).toContain("4 more");
    expect(output.length).toBeLessThanOrEqual(1500);
  });

  it("explains when nothing matches", async () => {
    const { run } = setup();
    expect(await run("find_open_slots", { from: "2027-01-01" })).toContain(
      "No open slots",
    );
  });
});

describe("select_time_slot", () => {
  it("selects by instant, whatever the offset", async () => {
    const { run, ctx } = setup();
    const output = parse(
      await run("select_time_slot", { datetime: "2026-11-01T15:00:00+01:00" }),
    );
    expect(ctx.selectTimeSlot).toHaveBeenCalledWith("2026-11-01T14:00:00.000Z");
    expect(output.slot.discountPercent).toBe(15);
  });

  it("refuses a booked slot and suggests the nearest open ones", async () => {
    const { run, ctx } = setup();
    const output = parse(
      await run("select_time_slot", { datetime: "2026-11-01T17:30:00.000Z" }),
    );
    expect(ctx.selectTimeSlot).not.toHaveBeenCalled();
    expect(output.error).toContain("isn't an open slot");
    expect(output.nearest).toHaveLength(3);
  });
});

describe("set_booking_options", () => {
  it("passes the patch on and reports adjustments", async () => {
    const { run, ctx } = setup();
    const output = parse(
      await run("set_booking_options", {
        activityFormat: "pouring",
        canvasType: "big",
      }),
    );
    expect(ctx.applyOptions).toHaveBeenCalledWith({
      activityFormat: "pouring",
      canvasType: "big",
    });
    expect(output.message).toContain("canvasType: big → standard");
    expect(output.message).toContain("only available with Splash");
  });

  it("applies the selected slot's discount to the price", async () => {
    const { run } = setup({ selectedTimeSlot: "2026-11-01T14:00:00.000Z" });
    const output = parse(await run("set_booking_options", { kids: 1 }));
    expect(output.price).toBe(formatPrice(5100));
  });

  it("rejects values of the wrong type", async () => {
    const { run } = setup();
    await expect(
      run("set_booking_options", { adults: "two" }),
    ).rejects.toThrow();
  });
});

describe("get_booking_summary and start_payment", () => {
  it("asks for a slot first", async () => {
    const { run, ctx } = setup();
    const summary = parse(await run("get_booking_summary"));
    expect(summary.readyToPay).toBe(false);
    expect(summary.message).toContain("No time slot");

    expect(await run("start_payment")).toContain("No time slot");
    expect(ctx.startPayment).not.toHaveBeenCalled();
  });

  it("blocks a group bigger than the spots left", async () => {
    const { run } = setup({
      eventType: "open_session",
      availability: [{ time: "2026-11-01T10:00:00.000Z", spotsLeft: 2 }],
      selectedTimeSlot: "2026-11-01T10:00:00.000Z",
    });
    expect(parse(await run("get_booking_summary")).message).toContain(
      "Only 2 spots",
    );
  });

  it("opens the payment form and reports the server price", async () => {
    const { run, ctx } = setup({
      selectedTimeSlot: "2026-11-01T10:00:00.000Z",
    });
    expect(parse(await run("get_booking_summary")).readyToPay).toBe(true);

    const output = await run("start_payment");
    expect(ctx.startPayment).toHaveBeenCalled();
    expect(output).toContain(formatPrice(5100));
    expect(output).toContain("card details");
  });

  it("explains a slot that filled up meanwhile", async () => {
    const { run } = setup({
      selectedTimeSlot: "2026-11-01T10:00:00.000Z",
      startPayment: async () => ({ ok: false, reason: "slot_full" }),
    });
    expect(await run("start_payment")).toContain("no longer available");
  });
});
