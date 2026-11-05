import {
  WEBMCP_EVENT_TYPES,
  isWebMcpEventType,
} from "@/services/agentTools/eventTypes";

import { formatMessage, loadWebMcpData, type WebMcpData } from "./data";
import { registerWebMcpTool } from "./register";
import type { WebMcpTool } from "./types";

// Site-wide tools, registered on every page from Layout.astro. Descriptions
// are English (read by the agent); output is in the page language.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SiteToolsDeps = {
  lang: string;
  loadData: (lang: string) => Promise<WebMcpData>;
  location: { pathname: string; search: string };
  navigate: (url: string) => void;
};

function json(value: unknown): string {
  return JSON.stringify(value);
}

function contactLine(data: WebMcpData): string {
  return formatMessage(data.messages, "contact", data.contact);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Exact match first, then the question sharing the most words with the input.
export function findFaqEntry(
  faq: WebMcpData["faq"],
  question: string,
): WebMcpData["faq"][number] | undefined {
  const wanted = normalize(question);
  if (!wanted) return undefined;

  const exact = faq.find((entry) => normalize(entry.question) === wanted);
  if (exact) return exact;

  const wantedWords = new Set(wanted.split(" ").filter((w) => w.length > 2));
  let best: { entry: WebMcpData["faq"][number]; score: number } | undefined;
  for (const entry of faq) {
    const words = normalize(entry.question).split(" ");
    const score = words.filter((word) => wantedWords.has(word)).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry;
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function buildBookingPageUrl(
  path: string,
  currentSearch: string,
  date?: string,
): string {
  const params = new URLSearchParams();
  const partner = new URLSearchParams(currentSearch).get("partner");
  if (partner) params.set("partner", partner);
  if (date) params.set("date", date);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildSiteTools(deps: SiteToolsDeps): WebMcpTool[] {
  const data = () => deps.loadData(deps.lang);

  const listExperiences: WebMcpTool = {
    name: "list_experiences",
    description:
      "List SplashPlay's painting experiences in Barcelona: name, starting price, duration in minutes, number of people, and whether it can be booked online. Use it to choose the experience before calling open_booking_page.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const d = await data();
      return json({ experiences: d.experiences, contact: contactLine(d) });
    },
  };

  const getFaq: WebMcpTool = {
    name: "get_faq",
    description:
      "Answers about the studio: location, what to wear, cancellations, ages, and more. Call without a question to list the questions, then call again with one question to get its answer.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "One question from the list, or the user's own words.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const d = await data();
      const question =
        typeof input.question === "string" ? input.question.trim() : "";
      if (!question) {
        return json({
          questions: d.faq.map((entry) => entry.question),
          location: d.location,
        });
      }
      const entry = findFaqEntry(d.faq, question);
      if (!entry) {
        return formatMessage(d.messages, "faq_not_found", { question });
      }
      return json(entry);
    },
  };

  const openBookingPage: WebMcpTool = {
    name: "open_booking_page",
    description:
      "Open the booking page for an experience. couples: exactly 2 people. family: adults with kids. friends: a group of adults. open_session: a shared session where each person buys a seat, also the option for one person. The page reloads; its booking tools (find_open_slots and others) are available once it loads.",
    inputSchema: {
      type: "object",
      properties: {
        experience: {
          type: "string",
          enum: [...WEBMCP_EVENT_TYPES],
          description: "Which experience to book.",
        },
        date: {
          type: "string",
          description:
            "Optional day to open the calendar on, as YYYY-MM-DD (Barcelona time).",
        },
        guests: {
          type: "integer",
          description:
            "Optional number of people, checked against what the experience allows.",
        },
      },
      required: ["experience"],
    },
    execute: async (input) => {
      const d = await data();
      const experience = String(input.experience ?? "");
      const names = Object.fromEntries(
        d.experiences.map((e) => [e.experience, e.name]),
      );

      if (!isWebMcpEventType(experience)) {
        const contactOnly = d.experiences.find(
          (e) => e.experience === experience && !e.bookOnline,
        );
        if (contactOnly) {
          return `${formatMessage(d.messages, "contact_only", { name: contactOnly.name })} ${contactLine(d)}`;
        }
        return formatMessage(d.messages, "not_available", {
          options: WEBMCP_EVENT_TYPES.join(", "),
        });
      }

      const name = names[experience] ?? experience;
      const date = typeof input.date === "string" ? input.date.trim() : "";
      if (date && !DATE_PATTERN.test(date)) {
        return formatMessage(d.messages, "invalid_date", {
          example: new Date().toISOString().slice(0, 10),
        });
      }

      if (input.guests != null) {
        const guests = Number(input.guests);
        const { min, max } = d.guestBounds[experience];
        if (!Number.isInteger(guests) || guests < min || guests > max) {
          const message =
            min === max
              ? formatMessage(d.messages, "guests_exact", { name, min })
              : formatMessage(d.messages, "guests_out_of_range", {
                  name,
                  min,
                  max,
                  guests: String(input.guests),
                });
          return `${message} ${contactLine(d)}`;
        }
      }

      const path = d.bookingPaths[experience];
      const current = stripTrailingSlash(deps.location.pathname);
      const onThatPage = current === path || current === `/${deps.lang}${path}`;
      if (onThatPage && !date) {
        return formatMessage(d.messages, "already_on_page", { name });
      }

      const url = buildBookingPageUrl(path, deps.location.search, date);
      // Let the reply reach the agent before the page unloads.
      setTimeout(() => deps.navigate(url), 50);
      return formatMessage(d.messages, "opening_page", { name });
    },
  };

  return [listExperiences, getFaq, openBookingPage];
}

export function registerSiteTools(lang: string): void {
  const controller = new AbortController();
  const tools = buildSiteTools({
    lang,
    loadData: loadWebMcpData,
    location: window.location,
    navigate: (url) => window.location.assign(url),
  });
  // Never aborted: the tools live as long as the page.
  for (const tool of tools) {
    registerWebMcpTool(tool, controller.signal);
  }
}
