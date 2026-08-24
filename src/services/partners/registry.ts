import * as z from "zod";
import { PARTNERS_CONFIG } from "astro:env/server";

export type Partner = {
  webhookUrl: string;
  secret: string;
};

const PartnersConfigSchema = z
  .string()
  .transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON string" });
      return z.NEVER;
    }
  })
  .pipe(
    z.record(
      z.string(),
      z.object({
        webhookUrl: z.url(),
        secret: z.string().min(1),
      }),
    ),
  );

function parsePartnersConfig(): Map<string, Partner> {
  const parsed = PartnersConfigSchema.safeParse(PARTNERS_CONFIG);
  if (!parsed.success) {
    console.error(
      "PARTNERS_CONFIG failed validation, ignoring",
      z.flattenError(parsed.error),
    );
    return new Map();
  }

  return new Map(Object.entries(parsed.data));
}

// Map, not a plain object — immune to prototype-property lookups
// (e.g. partnerKey="constructor") that `in`/bracket access on an object would allow.
const partners = parsePartnersConfig();

// partnerKey is always a lookup key here — never use it as a request destination.
export function getPartner(partnerKey: string): Partner | undefined {
  return partners.get(partnerKey);
}

export function isKnownPartner(partnerKey: string): boolean {
  return partners.has(partnerKey);
}
