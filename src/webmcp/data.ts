import type {
  WebMcpData,
  WebMcpMessages,
} from "@/services/agentTools/webmcpData";

export type { WebMcpData, WebMcpMessages };

const cache = new Map<string, Promise<WebMcpData>>();

// Fetched on the first tool call, not at registration, so even WebMCP
// browsers only download it when an agent actually uses a tool.
export function loadWebMcpData(lang: string): Promise<WebMcpData> {
  let pending = cache.get(lang);
  if (!pending) {
    pending = fetch(`/webmcp/${lang}.json`).then((res) => {
      if (!res.ok) throw new Error(`Couldn't load /webmcp/${lang}.json`);
      return res.json() as Promise<WebMcpData>;
    });
    pending.catch(() => cache.delete(lang));
    cache.set(lang, pending);
  }
  return pending;
}

export function formatMessage(
  messages: WebMcpMessages,
  key: keyof WebMcpMessages,
  vars: Record<string, string | number> = {},
): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
