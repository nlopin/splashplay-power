import type { APIRoute } from "astro";
import { getAvailableTime } from "../../services/calendly";

export const GET: APIRoute = async () => {
    try {
        const availableTimes = await getAvailableTime();
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
        return new Response(JSON.stringify({ error: "Failed to fetch availability" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
};
