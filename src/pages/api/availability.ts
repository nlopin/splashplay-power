import type { APIRoute } from "astro";
import { getAvailableTime } from "@/services/calendly";
import { isEventType } from "@/components/booking/types";

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

    const availableTimes = await getAvailableTime(maybeEventType);
    const camelCaseTimes = availableTimes.map((time) => ({
      inviteesRemaining: time.invitees_remaining,
      schedulingUrl: time.scheduling_url,
      startTime: time.start_time,
      status: time.status,
    }));
    return new Response(JSON.stringify(camelCaseTimes), {
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
