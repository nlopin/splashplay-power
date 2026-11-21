import { useEffect, useRef } from "react";

import { isWebMcpAvailable, registerWebMcpTool } from "./register";
import type { WebMcpTool } from "./types";

/**
 * Registers WebMCP tools while the component is mounted and `tools` is not
 * null. Tools are registered once per set of names; each call runs the
 * latest render's `execute`, so tools always see current React state without
 * re-registering on every render.
 */
export function useWebMcpTools(tools: WebMcpTool[] | null): void {
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  const key = tools?.map((tool) => tool.name).join(",") ?? "";

  useEffect(() => {
    if (!key || !isWebMcpAvailable()) return;
    const controller = new AbortController();

    for (const tool of toolsRef.current ?? []) {
      registerWebMcpTool(
        {
          ...tool,
          execute: (input, context) => {
            const latest = toolsRef.current?.find((t) => t.name === tool.name);
            if (!latest) {
              return "This tool is no longer available on the page.";
            }
            return latest.execute(input, context);
          },
        },
        controller.signal,
      );
    }

    return () => controller.abort();
  }, [key]);
}
