import type { APIRoute, GetStaticPaths } from "astro";

import { buildWebMcpData } from "@/services/agentTools/webmcpData";
import { languages, type Language } from "@/utils/i18n";

// Static per-language data for the in-browser WebMCP tools (src/webmcp/).
export const prerender = true;

export const getStaticPaths = (() =>
  languages.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(buildWebMcpData(params.lang as Language)), {
    headers: { "Content-Type": "application/json" },
  });
