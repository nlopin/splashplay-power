import { AnalyticsEvents, trackEvent } from "@/services/analytics";

import type { WebMcpTool } from "./types";

// Chrome's guidance: keep tool output under ~1.5K characters or agents may
// drop it. Tools are designed to stay under this; the cap is a backstop.
export const MAX_TOOL_OUTPUT_CHARS = 1500;

export function isWebMcpAvailable(): boolean {
  return typeof document !== "undefined" && document.modelContext != null;
}

export function truncateOutput(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS - 1)}…`;
}

// Every tool goes through here, so an API rename touches one file.
export function registerWebMcpTool(tool: WebMcpTool, signal: AbortSignal): void {
  const modelContext = isWebMcpAvailable() ? document.modelContext : undefined;
  if (!modelContext || signal.aborted) return;

  const wrapped: WebMcpTool = {
    ...tool,
    execute: async (input, context) => {
      trackEvent(AnalyticsEvents.AgentToolCalled, { tool: tool.name });
      try {
        return truncateOutput(await tool.execute(input ?? {}, context));
      } catch (error) {
        console.error(`webmcp: ${tool.name} failed`, error);
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  // registerTool rejects with NotAllowedError when the `tools` permission
  // policy blocks it; that must never break the page.
  Promise.resolve()
    .then(() => modelContext.registerTool(wrapped, { signal }))
    .catch((error) => {
      console.warn(`webmcp: ${tool.name} not registered`, error);
    });
}
