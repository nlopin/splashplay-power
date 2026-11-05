import * as z from "zod";

import type {
  Availability,
  PricingData,
  SelectedTimeSlot,
} from "@/components/booking/types";
import type {
  Adjustment,
  OptionsApplyResult,
  OptionsPatch,
} from "@/components/booking/eventTypeOptions/formState";
import type { WebMcpEventType } from "@/services/agentTools/eventTypes";
import {
  ActivityFormatSchema,
  AdultsSchema,
  CanvasesSchema,
  CanvasTypeSchema,
  CouplesPictureSchema,
  KidsSchema,
  OpenSessionTicketCountSchemas,
} from "@/services/agentTools/schemas";
import { formatPrice } from "@/utils/price";

import { formatMessage, type WebMcpData } from "./data";
import {
  TIMES_OF_DAY,
  filterSlots,
  findSlot,
  nearestSlots,
  openSlots,
  summarizeSlot,
  type TimeOfDay,
} from "./slots";
import type { JsonSchema, WebMcpTool } from "./types";

// Tools on a booking page's schedule step, built by BookingForm on every
// render so they always see current state. Descriptions are English (read by
// the agent); output is in the page language.

const MAX_SLOTS = 10;

export type PaymentResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: "not_ready" | "busy" | "slot_full" | "failed" };

export type BookingToolsContext = {
  eventType: WebMcpEventType;
  lang: string;
  availability: Availability;
  selectedTimeSlot: SelectedTimeSlot | null;
  pricing: PricingData | null;
  isLoading: boolean;
  now: () => Date;
  themeName: (slug: string) => string | undefined;
  selectTimeSlot: (time: SelectedTimeSlot) => void;
  applyOptions: (patch: OptionsPatch) => OptionsApplyResult | null;
  startPayment: () => Promise<PaymentResult>;
  loadData: (lang: string) => Promise<WebMcpData>;
};

const GuestsSchema = z
  .number()
  .int()
  .positive()
  .describe("Number of people in the group, 1–6.");

const OPTION_FIELDS: Record<WebMcpEventType, z.ZodRawShape> = {
  couples: {
    activityFormat: ActivityFormatSchema.optional(),
    picture: CouplesPictureSchema.optional(),
  },
  family: {
    adults: AdultsSchema.optional(),
    kids: KidsSchema.optional(),
    activityFormat: ActivityFormatSchema.optional(),
    canvasType: CanvasTypeSchema.optional(),
    canvases: CanvasesSchema.optional(),
  },
  friends: {
    guests: GuestsSchema.optional(),
    activityFormat: ActivityFormatSchema.optional(),
    canvasType: CanvasTypeSchema.optional(),
    canvases: CanvasesSchema.optional(),
  },
  open_session: {
    solo: OpenSessionTicketCountSchemas.solo.optional(),
    pair_shared: OpenSessionTicketCountSchemas.pair_shared.optional(),
    pair_two: OpenSessionTicketCountSchemas.pair_two.optional(),
  },
};

const OPTION_HINTS: Record<WebMcpEventType, string> = {
  couples: "Couples sessions are for 2 people; choose the canvas and format.",
  family:
    "Family sessions: up to 6 people in total, at least one adult. Canvases default to one per person.",
  friends: "Friends sessions: 1–6 people. Canvases default to one per person.",
  open_session:
    "Open sessions are shared with other people; buy tickets per person or pair. The total is limited by spots left in the selected slot, so select a slot first.",
};

// zod's JSON Schema output carries noise Chrome's WebMCP DevTools pane can't
// render (no parameter form is shown): $schema, additionalProperties, the
// safe-integer bounds on every .int(), and exclusiveMinimum for .positive().
// Reduce it to the plain form the hand-written tool schemas use.
function simplifySchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplifySchema);
  if (!node || typeof node !== "object") return node;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "additionalProperties") continue;
    if (key === "maximum" && value === Number.MAX_SAFE_INTEGER) continue;
    if (key === "minimum" && value === Number.MIN_SAFE_INTEGER) continue;
    result[key] = simplifySchema(value);
  }
  if (typeof result.exclusiveMinimum === "number") {
    const bound = result.exclusiveMinimum;
    delete result.exclusiveMinimum;
    result.minimum = result.type === "integer" ? bound + 1 : bound;
  }
  return result;
}

function toJsonSchema(shape: z.ZodRawShape): JsonSchema {
  return simplifySchema(z.toJSONSchema(z.object(shape))) as JsonSchema;
}

const optionSchemas = new Map<WebMcpEventType, JsonSchema>();
function optionsInputSchema(eventType: WebMcpEventType): JsonSchema {
  let schema = optionSchemas.get(eventType);
  if (!schema) {
    schema = toJsonSchema(OPTION_FIELDS[eventType]);
    optionSchemas.set(eventType, schema);
  }
  return schema;
}

function pickPatch(
  eventType: WebMcpEventType,
  input: Record<string, unknown>,
): OptionsPatch {
  const parsed = z.object(OPTION_FIELDS[eventType]).safeParse(input);
  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }
  return parsed.data as OptionsPatch;
}

function priceAfterDiscount(amount: number, discount?: number): number {
  return discount ? Math.round(amount * (1 - discount / 100)) : amount;
}

function describeAdjustments(adjusted: Adjustment[]): string {
  return adjusted
    .map(({ field, requested, actual }) => `${field}: ${requested} → ${actual}`)
    .join(", ");
}

export function buildBookingTools(ctx: BookingToolsContext): WebMcpTool[] {
  const data = () => ctx.loadData(ctx.lang);
  const open = () => openSlots(ctx.availability, ctx.now());
  const summarize = (slot: Parameters<typeof summarizeSlot>[0]) =>
    summarizeSlot(slot, ctx.lang, ctx.themeName);
  const selectedSlot = () =>
    ctx.selectedTimeSlot
      ? ctx.availability.find((slot) => slot.time === ctx.selectedTimeSlot)
      : undefined;

  // Same conditions that enable the "Pay to book" button in ScheduleStep.
  const blocker = (d: WebMcpData): string | null => {
    const slot = selectedSlot();
    if (!slot) return formatMessage(d.messages, "no_slot_selected");
    if (!ctx.pricing || ctx.pricing.amount <= 0) {
      return formatMessage(d.messages, "add_participants");
    }
    if (slot.spotsLeft != null && ctx.pricing.guests > slot.spotsLeft) {
      return formatMessage(d.messages, "not_enough_spots", {
        spotsLeft: slot.spotsLeft,
      });
    }
    return null;
  };

  const findOpenSlots: WebMcpTool = {
    name: "find_open_slots",
    description: `Find open time slots for this experience, soonest first, with any discount${ctx.eventType === "open_session" ? ", spots left and theme" : ""}. Returns at most ${MAX_SLOTS}; narrow the dates to see more. Pass a slot's datetime to select_time_slot.`,
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "First day to include, YYYY-MM-DD (Barcelona time).",
        },
        to: {
          type: "string",
          description: "Last day to include, YYYY-MM-DD (Barcelona time).",
        },
        timeOfDay: {
          type: "string",
          enum: [...TIMES_OF_DAY],
          description:
            "morning: before 14:00. afternoon: 14:00–17:59. evening: 18:00 or later.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const d = await data();
      const matches = filterSlots(open(), {
        from: typeof input.from === "string" ? input.from : undefined,
        to: typeof input.to === "string" ? input.to : undefined,
        timeOfDay: TIMES_OF_DAY.includes(input.timeOfDay as TimeOfDay)
          ? (input.timeOfDay as TimeOfDay)
          : undefined,
      });
      if (matches.length === 0) return formatMessage(d.messages, "slots_none");

      const more = matches.length - MAX_SLOTS;
      return JSON.stringify({
        slots: matches.slice(0, MAX_SLOTS).map(summarize),
        ...(more > 0
          ? { note: formatMessage(d.messages, "slots_more", { count: more }) }
          : {}),
      });
    },
  };

  const selectTimeSlot: WebMcpTool = {
    name: "select_time_slot",
    description:
      "Select a time slot on the booking page, as if the user clicked it in the calendar. Use a datetime returned by find_open_slots.",
    inputSchema: {
      type: "object",
      properties: {
        datetime: {
          type: "string",
          description: "The slot's datetime from find_open_slots (ISO 8601).",
        },
      },
      required: ["datetime"],
    },
    execute: async (input) => {
      const d = await data();
      const datetime = String(input.datetime ?? "");
      const slots = open();
      const slot = findSlot(slots, datetime);
      if (!slot) {
        return JSON.stringify({
          error: formatMessage(d.messages, "slot_not_open", { datetime }),
          nearest: nearestSlots(slots, datetime).map(summarize),
        });
      }
      ctx.selectTimeSlot(slot.time);
      const summary = summarize(slot);
      return JSON.stringify({
        message: formatMessage(d.messages, "slot_selected", {
          label: summary.label,
        }),
        slot: summary,
      });
    },
  };

  const setBookingOptions: WebMcpTool = {
    name: "set_booking_options",
    description: `Set the booking options shown on the page and get the resulting price. Only the fields you pass change; values the rules don't allow are adjusted and reported. ${OPTION_HINTS[ctx.eventType]}`,
    inputSchema: optionsInputSchema(ctx.eventType),
    execute: async (input) => {
      const d = await data();
      const result = ctx.applyOptions(pickPatch(ctx.eventType, input));
      if (!result) return formatMessage(d.messages, "options_not_ready");

      const discount = selectedSlot()?.discount;
      const { adjusted } = result;
      const notes = [
        adjusted.length
          ? formatMessage(d.messages, "options_adjusted", {
              changes: describeAdjustments(adjusted),
            })
          : formatMessage(d.messages, "options_updated"),
        ...(adjusted.some(
          (a) => a.field === "canvasType" && a.requested === "big",
        )
          ? [formatMessage(d.messages, "big_canvas_splash_only")]
          : []),
      ];
      return JSON.stringify({
        message: notes.join(" "),
        selection: result.data.selection,
        people: result.data.guests,
        price: formatPrice(priceAfterDiscount(result.data.amount, discount)),
        ...(adjusted.length ? { adjusted } : {}),
      });
    },
  };

  const getBookingSummary: WebMcpTool = {
    name: "get_booking_summary",
    description:
      "Show what is selected on the booking page: time slot, options, people, price after any discount, and whether it's ready to pay (or what's missing).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const d = await data();
      const slot = selectedSlot();
      const missing = blocker(d);
      return JSON.stringify({
        slot: slot ? summarize(slot) : null,
        selection: ctx.pricing?.selection ?? null,
        people: ctx.pricing?.guests ?? 0,
        price: ctx.pricing
          ? formatPrice(priceAfterDiscount(ctx.pricing.amount, slot?.discount))
          : null,
        readyToPay: missing === null,
        message: missing ?? formatMessage(d.messages, "ready_to_pay"),
      });
    },
  };

  const startPayment: WebMcpTool = {
    name: "start_payment",
    description:
      "Open the secure payment form for the current selection, like pressing the pay button. Confirm the summary with the user first. The user enters their card details themselves; no payment happens without them.",
    inputSchema: { type: "object", properties: {} },
    annotations: { consequentialHint: true },
    execute: async () => {
      const d = await data();
      const missing = blocker(d);
      if (missing) return missing;
      if (ctx.isLoading) return formatMessage(d.messages, "payment_loading");

      const result = await ctx.startPayment();
      if (result.ok) {
        return formatMessage(d.messages, "payment_shown", {
          amount: formatPrice(result.amountCents),
        });
      }
      switch (result.reason) {
        case "busy":
          return formatMessage(d.messages, "payment_loading");
        case "slot_full":
          return formatMessage(d.messages, "payment_slot_full");
        case "not_ready":
          return formatMessage(d.messages, "no_slot_selected");
        case "failed":
          return formatMessage(d.messages, "payment_failed");
      }
    },
  };

  return [
    findOpenSlots,
    selectTimeSlot,
    setBookingOptions,
    getBookingSummary,
    startPayment,
  ];
}
