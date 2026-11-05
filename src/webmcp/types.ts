// Minimal typings for Chrome's WebMCP API (document.modelContext), covering
// only what this site uses. The API is in an origin trial and still changing:
// https://developer.chrome.com/docs/ai/webmcp/imperative-api

export type JsonSchema = Record<string, unknown>;

export type WebMcpToolAnnotations = {
  // Only reads state, no side effects.
  readOnlyHint?: boolean;
  // Significant action; the browser or agent may ask the user to confirm.
  consequentialHint?: boolean;
  // Output contains user-generated or external content.
  untrustedContentHint?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: WebMcpToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    context: { signal?: AbortSignal },
  ) => Promise<string> | string;
};

export interface ModelContext extends EventTarget {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void> | void;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
