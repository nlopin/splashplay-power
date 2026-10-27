import { formatPrice } from "@/utils/price";

import { formatMessage, loadWebMcpData, type WebMcpData } from "./data";
import { registerWebMcpTool } from "./register";
import type { WebMcpTool } from "./types";

// What /complete already rendered on the server for this checkout session.
export type BookingConfirmation = {
  status: string;
  title: string;
  time: string;
  amountCents: number;
};

export function buildConfirmationTool(
  confirmation: BookingConfirmation,
  deps: { lang: string; loadData: (lang: string) => Promise<WebMcpData> },
): WebMcpTool {
  return {
    name: "get_booking_confirmation",
    description:
      "Check whether the booking on this page was paid and confirmed, after the user completed the payment form.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const { messages } = await deps.loadData(deps.lang);
      const { status } = confirmation;
      if (status === "success") {
        return JSON.stringify({
          status,
          message: formatMessage(messages, "booking_confirmed", {
            title: confirmation.title,
            amount: formatPrice(confirmation.amountCents),
          }),
          ...(confirmation.time ? { time: confirmation.time } : {}),
        });
      }
      return JSON.stringify({
        status,
        message: formatMessage(
          messages,
          status === "processing" ? "booking_processing" : "booking_failed",
        ),
      });
    },
  };
}

export function registerConfirmationTool(
  lang: string,
  confirmation: BookingConfirmation,
): void {
  // Never aborted: the tool lives as long as the page.
  const controller = new AbortController();
  registerWebMcpTool(
    buildConfirmationTool(confirmation, { lang, loadData: loadWebMcpData }),
    controller.signal,
  );
}
