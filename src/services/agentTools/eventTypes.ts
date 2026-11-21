import { EVENT_TYPE } from "@/components/booking/types";

// Experiences an agent can book through WebMCP. `individual` is left out on
// purpose (docs/plans/18-webmcp.md, "Experience scope"). Kept free of catalog
// imports so the lazily loaded site-wide tools stay small.
export const WEBMCP_EVENT_TYPES = [
  EVENT_TYPE.COUPLES,
  EVENT_TYPE.FAMILY,
  EVENT_TYPE.FRIENDS,
  EVENT_TYPE.OPEN_SESSION,
] as const;

export type WebMcpEventType = (typeof WEBMCP_EVENT_TYPES)[number];

export function isWebMcpEventType(value: string): value is WebMcpEventType {
  return (WEBMCP_EVENT_TYPES as readonly string[]).includes(value);
}
