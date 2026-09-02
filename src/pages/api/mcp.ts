import type { APIContext, APIRoute } from "astro";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { EVENT_TYPE } from "@/components/booking/types";
import { getAvailability } from "@/services/availability";
import { getExperiences, getGuestBounds } from "@/services/catalog/experiences";
import { getFaq, getLocationInfo } from "@/services/catalog/faq";
import { getPriceCents } from "@/services/catalog/pricing";
import { formatCouplesProductName } from "@/services/catalog/couplesPricing";
import {
  formatFamilyProductName,
  clampFamilyCanvases,
} from "@/services/catalog/familyPricing";
import {
  formatFriendsProductName,
  clampFriendsCanvases,
} from "@/services/catalog/friendsPricing";
import {
  formatBookingProductName,
  getProductTitle,
} from "@/services/catalog/productName";
import { createHostedCheckoutSession } from "@/services/checkout/createCheckoutSession";
import { getCheckoutSessionStatus } from "@/services/checkout/status";
import { checkRateLimit } from "@/services/mcp/rateLimit";
import { languages, type Language } from "@/utils/i18n";
import { DEFAULT_LOCALE } from "@/constants";

export const prerender = false;

const LANG_VALUES = ["es", "en", "ca"] satisfies Language[];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

const SERVER_NAME = "splashplay-booking";
const SERVER_VERSION = "0.1.0";
// Mirrors the registerTool() calls below — no programmatic way to list them
// off the McpServer instance, so kept in sync by hand (four tools, one file).
const TOOL_NAMES = [
  "list_experiences",
  "check_availability",
  "create_booking_checkout",
  "get_booking_status",
] as const;

const LangSchema = z.enum(LANG_VALUES).describe(
  "Language for names/descriptions and the Stripe checkout page: es, en, or ca. Match the user's conversation language.",
);
// individual stays bookable on-site but isn't offered through the agent.
const MCP_EVENT_TYPES = [EVENT_TYPE.COUPLES, EVENT_TYPE.FAMILY, EVENT_TYPE.FRIENDS] as const;
const EventTypeSchema = z.enum(MCP_EVENT_TYPES);
const MCP_HIDDEN_EXPERIENCES = new Set<string>([EVENT_TYPE.INDIVIDUAL]);

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function getClientIp(ctx: APIContext): string {
  try {
    return ctx.clientAddress;
  } catch {
    return (
      ctx.request.headers.get("x-nf-client-connection-ip") ??
      ctx.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    );
  }
}

// Derives whichever of adults/kids is missing and validates the sum in every
// case — not just when both are given (guests=3, kids=1 must resolve to 2
// adults, not "3 adults" via a naive `?? guests` default).
function resolveFamilySplit(
  guests: number,
  adults: number | undefined,
  kids: number | undefined,
): { adults: number; kids: number } | null {
  const resolvedAdults = adults ?? (kids !== undefined ? guests - kids : guests);
  const resolvedKids = kids ?? (adults !== undefined ? guests - adults : 0);
  if (resolvedAdults < 0 || resolvedKids < 0 || resolvedAdults + resolvedKids !== guests) {
    return null;
  }
  return { adults: resolvedAdults, kids: resolvedKids };
}

/** Fresh server per request — this endpoint runs stateless (see WebStandardStreamableHTTPServerTransport docs). */
function createMcpServer(origin: string): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "list_experiences",
    {
      title: "List experiences",
      description:
        "List SplashPlay's painting experiences with name, description, starting price (EUR cents), duration, and guest count range. Call this before quoting prices or availability. Check each entry's `booking.method`: \"checkout\" means check_availability/create_booking_checkout accept its eventType; \"contact\" (e.g. team building) has no online booking — tell the user to reach out via the given WhatsApp/email instead.",
      inputSchema: { lang: LangSchema.optional() },
    },
    async ({ lang }) =>
      jsonResult(
        getExperiences(lang ?? DEFAULT_LOCALE).filter(
          (experience) => !MCP_HIDDEN_EXPERIENCES.has(experience.eventType),
        ),
      ),
  );

  server.registerTool(
    "check_availability",
    {
      title: "Check availability",
      description:
        "List open time slots for one experience over the next N days (default 45, max 45). Only unbooked slots are returned.",
      inputSchema: {
        eventType: EventTypeSchema,
        days: z.number().int().positive().max(45).optional(),
      },
    },
    async ({ eventType, days = 45 }) => {
      // getAvailability's own `days` doesn't actually bound a warm cache's
      // results, so the window is re-applied here to match what we advertise.
      const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
      const slots = await getAvailability(eventType, days);
      return jsonResult(
        slots
          .filter((slot) => !slot.booked && new Date(slot.time).getTime() <= cutoff)
          .map((slot) => ({ time: slot.time, discountPercent: slot.discount })),
      );
    },
  );

  server.registerTool(
    "create_booking_checkout",
    {
      title: "Create booking checkout",
      description:
        "Create a Stripe-hosted checkout session for a booking and return its URL. The price is computed server-side from the catalog — never pass or trust a price from elsewhere. Send the checkout URL to the user to complete payment; call get_booking_status afterwards to confirm.",
      inputSchema: {
        eventType: EventTypeSchema,
        datetime: z.iso
          .datetime({ offset: true })
          .describe("ISO 8601 datetime with offset, from check_availability."),
        guests: z.number().int().positive().describe("number of participants. If the eventType is `couples`, set it to 2. For all other events, request it from the user."),
        lang: LangSchema.optional(),
        activityFormat: z
          .enum(["splash", "pouring"])
          .optional()
          .describe("couples/family/friends only: Splash (energetic — throwing, spinning, guns) or Pouring (calmer). Defaults to splash."),
        canvasType: z
          .enum(["standard", "big"])
          .optional()
          .describe("family/friends only: shared big canvas (60×90) vs. standard canvases. Friends and family may take 1 or 2 big canvases via `canvases` (defaults to 1; 1 guest max 1). If big canvas is selected and `canvases` is omitted, it is one."),
        canvases: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("family/friends only: number of canvases. For standard, usually one per guest. For a big canvas, 1 or 2 (max 2)."),
        picture: z
          .enum(["one_small", "one_big", "individual"])
          .optional()
          .describe("couples only: canvas format. `One_small` is one shared standard canvas 40x30, `one_big` is one shared big canvas, `individual` is a standard canvas for both"),
        adults: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("family only: number of adults. Ask the user for the adults/kids split — it's shown on the booking confirmation. If given with `kids`, must add up to `guests`."),
        kids: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("family only: number of kids. If given with `adults`, must add up to `guests`."),
      },
    },
    async ({ eventType, datetime, guests, lang, activityFormat, canvasType, canvases, picture, adults, kids }) => {
      const bounds = getGuestBounds(eventType);
      if (guests < bounds.min || guests > bounds.max) {
        return errorResult(
          `${eventType} bookings take ${bounds.min}–${bounds.max} guests, got ${guests}.`,
        );
      }
      const resolvedLang = lang ?? DEFAULT_LOCALE;
      const resolvedActivityFormat = activityFormat ?? "splash";
      const resolvedCanvasType = canvasType ?? "standard";
      const resolvedPicture = picture ?? "one_small";

      const amount = getPriceCents(eventType, { guests, canvases, canvasType, picture });

      // e.g. "2 guests, 2 canvases, splash" — the per-event-type options fragment.
      let eventOptions: string;
      switch (eventType) {
        case EVENT_TYPE.COUPLES:
          eventOptions = formatCouplesProductName(resolvedPicture, resolvedActivityFormat, resolvedLang);
          break;
        case EVENT_TYPE.FAMILY: {
          const split = resolveFamilySplit(guests, adults, kids);
          if (!split) {
            return errorResult(
              `adults (${adults ?? "?"}) and kids (${kids ?? "?"}) must add up to guests (${guests}), with neither negative.`,
            );
          }
          eventOptions = formatFamilyProductName(
            split.adults,
            split.kids,
            // Clamped so an out-of-range `canvases` shows what's actually charged.
            clampFamilyCanvases(
              canvases ?? (resolvedCanvasType === "big" ? 1 : guests),
              guests,
              resolvedCanvasType,
            ),
            resolvedCanvasType,
            resolvedActivityFormat,
          );
          break;
        }
        case EVENT_TYPE.FRIENDS:
          eventOptions = formatFriendsProductName(
            guests,
            clampFriendsCanvases(
              canvases ?? (resolvedCanvasType === "big" ? 1 : guests),
              guests,
              resolvedCanvasType,
            ),
            resolvedCanvasType,
            resolvedActivityFormat,
          );
          break;
      }

      // "{title}, {date} {time} ({eventOptions})" — same shape as BookingForm.tsx.
      const productName = formatBookingProductName(
        getProductTitle(eventType, resolvedLang),
        datetime,
        eventOptions,
        resolvedLang,
      );

      const session = await createHostedCheckoutSession({
        amount,
        productName,
        guests,
        datetime,
        lang: resolvedLang,
        eventType,
        origin,
      });

      return jsonResult({
        checkoutUrl: session.url,
        sessionId: session.id,
        amountCents: amount,
        currency: "EUR",
      });
    },
  );

  server.registerTool(
    "get_booking_status",
    {
      title: "Get booking status",
      description:
        "Check whether a checkout session (from create_booking_checkout) has been paid, to confirm the booking to the user.",
      inputSchema: { sessionId: z.string().min(1) },
    },
    async ({ sessionId }) => {
      try {
        return jsonResult(await getCheckoutSessionStatus(sessionId));
      } catch (error) {
        // Stripe's actual "no such session" signal — anything else (network
        // blip, outage) is a lookup failure, not proof the booking doesn't exist.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "resource_missing"
        ) {
          return errorResult(`No checkout session found for id "${sessionId}".`);
        }
        console.error("get_booking_status: lookup failed", error);
        return errorResult(
          "Couldn't check the booking status right now — this looks like a temporary issue, not a missing booking. Please try again in a moment.",
        );
      }
    },
  );

  for (const lang of languages) {
    server.registerResource(
      `faq-${lang}`,
      `splashplay://faq/${lang}`,
      {
        title: "FAQ & policies",
        description:
          "Frequently asked questions, studio location, and cancellation policy, in " + lang,
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              { faq: getFaq(lang), location: getLocationInfo(lang) },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }

  return server;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

const methodNotAllowed = () =>
  withCors(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    ),
  );

export const OPTIONS: APIRoute = async () =>
  withCors(new Response(null, { status: 204 }));

// Bare GET isn't part of the MCP protocol (the transport is POST-only JSON-RPC),
// but a browser, crawler, or an agent that just followed a link lands here with
// one — answer with plain info instead of a bare 405, so "booking MCP for
// agents" is discoverable by just opening the URL.
export const GET: APIRoute = async () =>
  withCors(
    new Response(
      JSON.stringify(
        {
          name: SERVER_NAME,
          version: SERVER_VERSION,
          description:
            "Booking MCP for agents — browse Splashplay's painting experiences, check availability, and create a Stripe checkout on the user's behalf.",
          protocol: "mcp",
          transport: "streamable-http",
          endpoint: {
            url: "/api/mcp",
            method: "POST",
            contentType: "application/json",
            note: "JSON-RPC 2.0 per the MCP spec — this GET response is informational only.",
          },
          tools: TOOL_NAMES,
          resources: ["faq"],
          documentation: "https://splashplay.es/llms.txt",
        },
        null,
        2,
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
export const DELETE: APIRoute = async () => methodNotAllowed();

export const POST: APIRoute = async (ctx) => {
  const clientIp = getClientIp(ctx);
  const rateLimit = await checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Rate limit exceeded, try again shortly." },
          id: null,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          },
        },
      ),
    );
  }

  const origin = new URL(ctx.request.url).origin;

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session to resume, so no SSE stream needed either
      enableJsonResponse: true,
    });
    const server = createMcpServer(origin);
    await server.connect(transport);
    return withCors(await transport.handleRequest(ctx.request));
  } catch (error) {
    console.error("Error handling MCP request:", error);
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
  }
};
