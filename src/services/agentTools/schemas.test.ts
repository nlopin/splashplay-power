import { describe, expect, it } from "vitest";
import * as z from "zod";

import * as schemas from "./schemas";

// Chrome's WebMCP guidance: parameter descriptions up to 150 characters.
const MAX_PARAM_DESCRIPTION = 150;

const fields: [string, z.ZodType][] = [
  ["ActivityFormatSchema", schemas.ActivityFormatSchema],
  ["CanvasTypeSchema", schemas.CanvasTypeSchema],
  ["CanvasesSchema", schemas.CanvasesSchema],
  ["CouplesPictureSchema", schemas.CouplesPictureSchema],
  ["AdultsSchema", schemas.AdultsSchema],
  ["KidsSchema", schemas.KidsSchema],
  ...Object.entries(schemas.OpenSessionTicketCountSchemas),
];

describe("shared agent tool schemas", () => {
  it.each(fields)(
    "%s has a description within the WebMCP budget",
    (_, schema) => {
      expect(schema.description).toBeTruthy();
      expect(schema.description!.length).toBeLessThanOrEqual(
        MAX_PARAM_DESCRIPTION,
      );
    },
  );

  it("converts to JSON Schema with descriptions kept", () => {
    const json = z.toJSONSchema(
      z.object({ activityFormat: schemas.ActivityFormatSchema.optional() }),
    ) as {
      properties: Record<string, { description?: string; enum?: string[] }>;
    };

    expect(json.properties.activityFormat.enum).toEqual(["splash", "pouring"]);
    expect(json.properties.activityFormat.description).toBe(
      schemas.ActivityFormatSchema.description,
    );
  });
});
