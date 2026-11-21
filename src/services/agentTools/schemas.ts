import * as z from "zod";

import { COUPLES_PICTURES } from "@/services/catalog/couplesPricing";
import { OPEN_SESSION_TICKETS } from "@/services/catalog/openSessionPricing";

// Booking option fields shared by the server MCP (src/pages/api/mcp.ts) and
// the in-browser WebMCP tools (src/webmcp/), so the two can't drift.
// Descriptions stay under 150 characters (Chrome's WebMCP guidance).

export const ActivityFormatSchema = z
  .enum(["splash", "pouring"])
  .describe(
    "Splash: energetic (throwing, spinning, water guns). Pouring: calmer, paint poured onto the canvas.",
  );

export const CanvasTypeSchema = z
  .enum(["standard", "big"])
  .describe(
    "standard: canvases, usually one per person. big: shared big 60×90 canvas (1 or 2), Splash only.",
  );

export const CanvasesSchema = z
  .number()
  .int()
  .positive()
  .describe(
    "Number of canvases. Standard: usually one per person. Big: 1 or 2.",
  );

export const CouplesPictureSchema = z
  .enum(COUPLES_PICTURES)
  .describe(
    "one_small: one shared 30×40. one_big: one shared big. two_big: two big (Splash only). individual: a standard canvas each.",
  );

export const AdultsSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Number of adults. Ask the user for the adults/kids split.");

export const KidsSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Number of kids. Ask the user for the adults/kids split.");

export const OpenSessionTicketCountSchemas = {
  solo: z
    .number()
    .int()
    .nonnegative()
    .describe("Tickets for one person with their own canvas."),
  pair_shared: z
    .number()
    .int()
    .nonnegative()
    .describe("Tickets for two people sharing one canvas."),
  pair_two: z
    .number()
    .int()
    .nonnegative()
    .describe("Tickets for two people with a canvas each."),
} satisfies Record<(typeof OPEN_SESSION_TICKETS)[number], z.ZodType>;
