import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_TOOL_OUTPUT_CHARS,
  isWebMcpAvailable,
  registerWebMcpTool,
  truncateOutput,
} from "./register";
import type { WebMcpTool } from "./types";

function stubModelContext() {
  const registerTool = vi.fn();
  vi.stubGlobal("document", { modelContext: { registerTool } });
  return registerTool;
}

const tool = (execute: WebMcpTool["execute"]): WebMcpTool => ({
  name: "test_tool",
  description: "A test tool.",
  inputSchema: { type: "object", properties: {} },
  execute,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isWebMcpAvailable", () => {
  it("is false without a document (SSR) or without modelContext", () => {
    expect(isWebMcpAvailable()).toBe(false);
    vi.stubGlobal("document", {});
    expect(isWebMcpAvailable()).toBe(false);
  });

  it("is true when document.modelContext exists", () => {
    stubModelContext();
    expect(isWebMcpAvailable()).toBe(true);
  });
});

describe("truncateOutput", () => {
  it("keeps short output and caps long output", () => {
    expect(truncateOutput("ok")).toBe("ok");
    const long = "x".repeat(MAX_TOOL_OUTPUT_CHARS + 50);
    expect(truncateOutput(long)).toHaveLength(MAX_TOOL_OUTPUT_CHARS);
  });
});

describe("registerWebMcpTool", () => {
  it("does nothing when WebMCP is unavailable", () => {
    vi.stubGlobal("document", {});
    expect(() =>
      registerWebMcpTool(tool(() => "ok"), new AbortController().signal),
    ).not.toThrow();
  });

  it("registers with the signal and turns thrown errors into text", async () => {
    const registerTool = stubModelContext();
    const controller = new AbortController();

    registerWebMcpTool(
      tool(() => {
        throw new Error("boom");
      }),
      controller.signal,
    );
    await Promise.resolve();

    expect(registerTool).toHaveBeenCalledTimes(1);
    const [registered, options] = registerTool.mock.calls[0];
    expect(options).toEqual({ signal: controller.signal });
    await expect(registered.execute({}, {})).resolves.toBe("Error: boom");
  });

  it("survives registerTool rejecting (permission policy)", async () => {
    const registerTool = stubModelContext();
    registerTool.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    registerWebMcpTool(tool(() => "ok"), new AbortController().signal);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
