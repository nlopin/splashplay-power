import type { APIRoute } from "astro";
import { getAvailability } from "@/services/availability";
import { isEventType } from "@/components/booking/types";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const maybeEventType = url.searchParams.get("type");

    if (!maybeEventType || !isEventType(maybeEventType)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing event type" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const availableTimes = await getAvailability(maybeEventType);
    return new Response(JSON.stringify(availableTimes), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch availability" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
