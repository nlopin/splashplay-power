import { describe, expect, it } from "vitest";

import { buildWebMcpData } from "@/services/agentTools/webmcpData";
import { formatPrice } from "@/utils/price";

import { buildConfirmationTool } from "./confirmationTool";

// ts-reset types JSON.parse as unknown; tests know the shape.
const parse = (text: string) => JSON.parse(text) as any;

const deps = { lang: "en", loadData: async () => buildWebMcpData("en") };

describe("get_booking_confirmation", () => {
  it("confirms a paid booking with what was bought and paid", async () => {
    const tool = buildConfirmationTool(
      {
        status: "success",
        title: "Family, Splash",
        time: "2026-11-01 11:00",
        amountCents: 5100,
      },
      deps,
    );
    const output = parse(await tool.execute({}, {}));
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(output.status).toBe("success");
    expect(output.message).toContain("Family, Splash");
    expect(output.message).toContain(formatPrice(5100));
  });

  it("explains a payment still processing or failed", async () => {
    const processing = buildConfirmationTool(
      { status: "processing", title: "", time: "", amountCents: 0 },
      deps,
    );
    expect(parse(await processing.execute({}, {})).message).toContain(
      "processing",
    );

    const failed = buildConfirmationTool(
      { status: "error", title: "", time: "", amountCents: 0 },
      deps,
    );
    expect(parse(await failed.execute({}, {})).message).toContain(
      "didn't go through",
    );
  });
});
