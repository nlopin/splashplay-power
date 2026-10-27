# Plan 18 — Expose the site to browser agents via WebMCP

**Effort:** M · **Depends on:** — (soft: 11, 13 — they move the booking
components this plan touches)

## Background

[WebMCP](https://developer.chrome.com/docs/ai/webmcp) is a proposed web
standard: a page registers tools (name, description, JSON Schema input,
`execute` callback) on `document.modelContext`, and the browser's agent
calls them instead of scraping the DOM and clicking. Tools run in the tab,
the user watches the UI change, and they exist only while the page is open.

Status (docs last updated 7 Oct 2026):

- Origin trial from **Chrome 149**. Locally: `chrome://flags/#enable-webmcp-testing`.
- Two APIs:
  - **Imperative** — `document.modelContext.registerTool(tool, { signal, exposedTo })`;
    unregister by aborting the signal. Tool = `{ name, description,
inputSchema, execute(input, { signal }), annotations }`. Annotations:
    `readOnlyHint`, `consequentialHint` (agent/browser may ask the user to
    confirm), `untrustedContentHint`.
  - **Declarative** — `toolname` / `tooldescription` / `toolautosubmit`
    attributes on a `<form>`; `SubmitEvent.agentInvoked` + `respondWith()`.
- Gated by the `tools` Permissions Policy (default `self`). `registerTool`
  rejects with `NotAllowedError` when disallowed. Secure origins only.
- Character budgets (exceeding them risks agent guardrails): tool
  description 500, param description 150, names 30, **tool output 1.5K**.
- Still under active discussion; API names have already changed
  (`navigator.modelContext` → `document.modelContext`, JSON-string inputs
  deprecated in Chrome 155). Treat as experimental.

We already have a server-side MCP server (`src/pages/api/mcp.ts`, four tools,
advertised in `public/.well-known/mcp.json` and `llms.txt`). Google's guidance
is to keep it and add WebMCP for in-tab actions: the server MCP serves
headless agents (ChatGPT, Claude), WebMCP serves an agent sitting in the
user's own browser on our page.

## Problem

A browser agent on `/book/family` today has to read the calendar DOM, click
day/time buttons, and work the +/- steppers in `FamilyOptions`. That is slow,
fragile (any CSS/markup change breaks it) and error-prone around rules the UI
enforces silently (canvas clamping, adults+kids split, pouring ⇒ no big
canvas, open-session spots left).

## Goal

- An agent on any page can learn what we offer and get to the right booking
  page in one call.
- On a booking page it can find a slot, select it, set the options and reach
  the Stripe payment form — with the UI updating visibly at every step.
- Payment details are always entered by the human in Stripe's embedded form.
  No tool ever sees card data or completes a payment.
- Zero effect on browsers without WebMCP (feature-detected, no errors, no
  extra network requests).
- Tool input schemas share one source with the server MCP so the two can't
  drift.

## Non-goals

- Declarative API: the site has no native `<form>` flows (`grep "<form" src`
  is empty — booking and gift cards are React/Stripe widgets). Revisit if a
  contact form is added.
- `exposedTo` / cross-origin exposure: tools stay same-origin.
- Replacing or changing the server MCP's behaviour.

## Design

### Tool set

Tools are registered only where they're useful (best-practice: register per
page state, unregister when not relevant).

**Experience scope.** WebMCP exposes couples, family, friends and **open
sessions**. `individual` is not exposed: it is left out of
`list_experiences`, `open_booking_page` rejects it, and `/book/individual`
registers no booking tools (the page works as today for humans). This
differs from the server MCP, which hides both (`MCP_HIDDEN_EXPERIENCES`);
WebMCP gets its own `WEBMCP_HIDDEN_EXPERIENCES = new Set([INDIVIDUAL])`.
Opening open sessions on the server MCP too is a separate decision.

**Every page** (registered from `Layout.astro`):

| Tool                | Hints    | Does                                                                                                                                                                                                                                                   |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_experiences`  | readOnly | Compact form of the server data: eventType, name, from-price, duration, guest range, bookable online or contact. Descriptions dropped (full list is ~1.8K chars, over budget). Includes open sessions, excludes `individual` (see "Experience scope"). |
| `get_faq`           | readOnly | `{ question? }`. Without it: the list of FAQ questions + address/metro. With it: that entry's answer (longest is ~440 chars). The full FAQ is ~4.8K chars, so it can't be returned in one call.                                                        |
| `open_booking_page` | —        | `{ experience, date?, guests? }` → navigates to the booking page for that experience in the current language. See "Navigating to the right booking page".                                                                                              |

Data for the first two (plus the `webmcp` output strings) comes from a
prerendered static file per language, `/webmcp/{lang}.json`, fetched only
when `document.modelContext` exists. Measured payload: ~6.8–7.5 KB raw,
~2.6–2.9 KB gzipped per language (fr is the largest). Inlining it would add
that to every page for every visitor; the fetch costs nothing for browsers
without WebMCP and is cached like any static asset. It also keeps every
locale out of the client bundle.

**Booking pages** (registered from `BookingForm` while `step === "schedule"`,
schema specific to the page's event type):

| Tool                  | Hints         | Does                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_open_slots`     | readOnly      | `{ from?, to?, timeOfDay?: "morning"\|"afternoon"\|"evening" }` → open slots from the `availability` prop already on the page, with discount and spots left. Capped (e.g. 20 slots) + "N more, narrow the range" to stay under 1.5K.                                                                                                                              |
| `select_time_slot`    | —             | `{ datetime }` → `handleTimeSlotSelect`. Calendar scrolls/highlights it. Error lists nearest open slots if not open.                                                                                                                                                                                                                                              |
| `set_booking_options` | —             | Event-type-specific params (couples: `picture`, `activityFormat`; family: `adults`, `kids`, `canvasType`, `canvases`, `activityFormat`; friends: `guests`, …; open session: cart). Applies through the same handlers the UI uses, returns the resulting (clamped) selection + displayed price + any warnings ("pouring has no big canvas, switched to standard"). |
| `get_booking_summary` | readOnly      | Current slot, selection, displayed price, discount, and whether "Pay to book" is enabled (and if not, why — same conditions as `ScheduleStep`).                                                                                                                                                                                                                   |
| `start_payment`       | consequential | Same as clicking "Pay to book" → `/api/payment-session` → shows the Stripe embedded form. Returns server-confirmed amount and "The payment form is shown; the user enters card details themselves."                                                                                                                                                               |

`start_payment` is the only tool with real-world consequence (it reserves
nothing and charges nothing, but it is the commit point the user should
confirm). Marking it `consequentialHint` lets the browser ask the user.

**Payment step:** no tools (unregister on step change). Card entry is
Stripe's iframe and is human-only by design.

**`/complete` page:** `get_booking_confirmation` (readOnly) — returns the
values the page already server-renders (title, time, amount, status). No new
API call.

### Navigating to the right booking page

There are four agent-bookable pages: `book/couples`, `book/family`,
`book/friends`, `book/open-session` (Spanish has no prefix, other languages
use `/en/`, `/ca/`, `/fr/`).

1. **Choosing the experience.** The agent calls `list_experiences`, which
   returns each `eventType` with its guest range and whether it can be booked
   online. The `experience` parameter is an enum of those four values. Its
   description tells the agent how to pick: couples = exactly 2 people;
   family = adults with kids; friends = a group of adults; open session = a
   shared session where each person buys a seat (also the option for one
   person, since `individual` isn't exposed). Team building is not an enum
   value; `list_experiences` returns it as "contact".
2. **Building the URL.** Reuse the existing helpers, no new path logic:
   `getLocalizedPath("/" + getBookingPath(eventType), pageLang)`. Keep
   `?partner=` if present. Add `?date=YYYY-MM-DD` when given so the calendar
   opens on that day (step 3 makes all booking pages read it; today only
   open session does).
3. **Checking before leaving.** If `guests` is given and outside the
   experience's range, return an error in the page language instead of
   navigating (e.g. "Friends sessions take 2–6 people; for 8, contact us").
   If the agent is already on that booking page, don't reload; return "You
   are on this booking page; use find_open_slots".
4. **Switching.** The tool is registered on every page, booking pages
   included, so moving from `family` to `friends` is the same call.
5. **After navigation.** The page unloads, so the call gets no reply
   (`executeTool` returns `null` on navigation). The description says so:
   "Opens the booking page. The page reloads; its booking tools are available
   once it loads." The new page registers its tools and Chrome fires
   `toolchange`, so the agent sees `find_open_slots` and the rest. How a tool
   call that navigates should return a result is still an open question in
   the spec (explainer issue #135); recheck when Chrome changes it.

### Mapping to the server MCP

| Server MCP                | WebMCP                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `list_experiences`        | `list_experiences` (same data)                                                                                                |
| `check_availability`      | `find_open_slots` (page data, filtered, UI-free)                                                                              |
| `create_booking_checkout` | `select_time_slot` + `set_booking_options` + `start_payment` (drives the visible UI, embedded checkout instead of hosted URL) |
| `get_booking_status`      | `get_booking_confirmation` on `/complete`                                                                                     |
| FAQ resource              | `get_faq`                                                                                                                     |

### Shared schemas

Move the zod pieces currently inline in `mcp.ts` (`LangSchema`,
`EventTypeSchema`, per-option enums and their `.describe()` text) into
`src/services/agentTools/schemas.ts`. Server MCP keeps using them as zod;
WebMCP converts with zod v4's `z.toJSONSchema()`. Trim descriptions to the
150-char param budget while moving (e.g. `picture` is ~190 today).

Strict validation stays in code (pure functions in
`src/services/catalog/*Pricing.ts` already clamp/validate); schemas stay
loose and errors are descriptive so the agent can retry — per the
best-practices page.

### Language of tool text

Tool and parameter descriptions: English, written once in code.

Tool output: page language (`es`, `en`, `ca`, `fr`). Output strings
(confirmations such as "Payment form is shown, the user enters card
details", warnings such as "pouring has no big canvas, switched to
standard", errors such as "not an open slot, nearest open slots: …") live in
a new `webmcp` namespace in `src/locales/{es,en,ca,fr}.json`. They ship in
the same `/webmcp/{lang}.json` file as the experiences and FAQ. Dates and prices are formatted with the
existing `src/utils/datetime.ts` / `src/utils/price.ts` helpers for the page
locale; ISO datetimes stay alongside so the agent can pass them back to
`select_time_slot`. A unit test checks every `webmcp` key exists in all four
locale files.

### Client plumbing — `src/webmcp/`

```ts
// src/webmcp/register.ts
export function isWebMcpAvailable(): boolean {
  return typeof document !== "undefined" && "modelContext" in document;
}

export function registerWebMcpTool(tool: WebMcpTool, signal: AbortSignal) {
  if (!isWebMcpAvailable()) return;
  document.modelContext
    .registerTool(
      {
        ...tool,
        execute: async (input, ctx) => {
          trackEvent(AnalyticsEvents.AgentToolCalled, { tool: tool.name });
          try {
            return truncate(await tool.execute(input, ctx), 1500);
          } catch (err) {
            return `Error: ${errorMessage(err)}`;
          }
        },
      },
      { signal },
    )
    .catch((err) => console.warn(`webmcp: ${tool.name} not registered`, err));
}
```

```ts
// src/webmcp/useWebMcpTool.ts — React hook
export function useWebMcpTool(tool: WebMcpTool | null) {
  const toolRef = useRef(tool);
  toolRef.current = tool; // execute always sees latest state, no re-register per render
  const enabled = tool !== null;
  const name = tool?.name;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    registerWebMcpTool(
      {
        ...toolRef.current!,
        execute: (i, c) => toolRef.current!.execute(i, c),
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [enabled, name]);
}
```

An in-house hook (~30 lines) rather than the experimental
`use-webmcp-tool` package: one less moving dependency while the API is in
flux. Types from the `webmcp-types` npm package (dev dependency) if it
matches the current API; otherwise a local `webmcp.d.ts`.

### Making the options components drivable

`CouplesOptions`, `FamilyOptions`, `FriendsOptions` and `OpenSessionOptions`
keep their form state internally and only emit
`onChange`. The tool needs to push values in. Smallest change: each exposes
an imperative handle via `forwardRef` + `useImperativeHandle`:

```ts
export interface OptionsHandle<P> {
  apply(patch: P): { applied: P; warnings: string[] };
}
```

`apply` reuses the component's existing handlers (so the same clamping runs
as on a click) and returns what actually got set. `BookingForm` holds the
ref and builds `set_booking_options` from it. Because the components already
call `onChange` from an effect, `get_booking_summary` reads the parent's
`currentSelection`/`currentAmount` after the update.

If plans 11/13 land first, the handle goes on whatever component they leave;
if this lands first, they carry the handle along (it's a move, not a
rewrite).

### Origin trial

Register `https://splashplay.es` for the WebMCP origin trial (Chrome
Origin Trials console). Token goes in `PUBLIC_WEBMCP_OT_TOKEN` (add to
`env.schema` in `astro.config.mjs`, optional). `Layout.astro` renders
`<meta http-equiv="origin-trial" content={token}>` only when it's set.
Preview deploys use a different origin → separate token or flag-only
testing.

Getting the token: sign in at
<https://developer.chrome.com/origintrials/#/trials/active>, open the WebMCP
trial, Register, origin `https://splashplay.es`, tick "match all
subdomains" only if `www.` serves pages too. Copy the token into the
Netlify environment variables (production context). The token is public by
design (it ends up in the HTML) and tied to the origin. Tokens expire;
check the expiry date in the console and set a reminder to renew.

## Steps

1. **Plumbing, no tools.** OT meta tag + env var; `src/webmcp/register.ts`,
   `useWebMcpTool.ts`, types; `AgentToolCalled` analytics event. Ship and
   confirm in Chrome 149+ that `document.modelContext` exists on prod and
   nothing changes elsewhere.
2. **Shared schemas.** Move zod schemas out of `mcp.ts` into
   `src/services/agentTools/schemas.ts`, trim descriptions to budget. Server
   MCP behaviour unchanged (run `pnpm smoke-test` against a preview).
3. **Site-wide read-only tools.** `list_experiences`, `get_faq`,
   `open_booking_page`; prerendered `/webmcp/[lang].json` route. Add the
   `webmcp` locale namespace (all four languages) and the key-parity test.
   Make `?date=` preselect work for all booking types (today only
   `open_session` reads it).
4. **Options handles.** `apply()` on each options component + unit tests
   that `apply` produces the same selection as the equivalent clicks
   (pure reducer tests where the logic lives in `services/catalog`).
5. **Booking tools.** `find_open_slots`, `select_time_slot`,
   `set_booking_options`, `get_booking_summary` in `BookingForm`; registered
   only on the schedule step.
6. **`start_payment`.** `consequentialHint: true`. Extend
   `/api/payment-session` response with `amountCents` (server-priced) so the
   tool reports the exact charge; `CreatePaymentSessionResponseSchema`
   updated. Guard: one in-flight call (existing abort logic covers this).
7. **`/complete` tool + discoverability.** `get_booking_confirmation`;
   add a "WebMCP" paragraph to `llms.txt` listing the in-browser tools.
8. **Evals.** Scripted conversations from the build-tools guide, run with
   the Model Context Tool Inspector extension: e.g. "Book a family session
   next Sunday afternoon for 2 adults and 2 kids, pouring", "Couples, one big
   canvas, cheapest discounted slot this month", "Open session on Halloween
   for 3", an unbookable request (team building → contact handoff), a full
   slot. Record tool-call traces; check tool choice, parameters, and that the
   agent stops at the payment form.

## Verification

- `vitest run`, `astro check` green each step.
- Local: `pnpm dev`, Chrome 149+ with `chrome://flags/#enable-webmcp-testing`
  (localhost counts as a secure origin; no token needed). In the console:
  `await document.modelContext.getTools()` lists the tools;
  `await document.modelContext.executeTool(tool, input)` runs one.
- Unit tests: each tool's `execute` is a plain function over page state;
  test it in vitest with a stub `document.modelContext`.
- Chrome with `#enable-webmcp-testing`: DevTools → Application → WebMCP
  panel shows the expected tools per page, schemas parse, tools disappear on
  the payment step. The panel can also run a tool by hand (select it,
  enter parameters, Run tool) and logs every call with input and output.
- Model Context Tool Inspector / `GoogleChromeLabs/webmcp-extension`: run
  the step-8 scenarios end to end on a preview deploy (Stripe test mode).
- Safari/Firefox/old Chrome: no console errors, no behaviour change.
- Amplitude: `AgentToolCalled` events appear (to measure adoption).

## Risks

- **API churn.** Experimental; names and semantics have already changed.
  Everything goes through `src/webmcp/register.ts` so a rename is one file.
  Origin-trial tokens expire — calendar reminder to renew.
- **Output budget.** 45 days of slots blows past 1.5K characters — hence
  filters + cap on `find_open_slots`. `truncate()` is a backstop, not the
  design.
- **Agent-driven Stripe sessions.** A looping agent could create many
  checkout sessions via `start_payment`. Same exposure as a user clicking
  repeatedly (no rate limit on `/api/payment-session` today); consider a
  per-IP limit reusing `src/services/mcp/rateLimit.ts`.
- **Prompt injection.** Our tool outputs are our own catalog text, not
  user-generated, so no `untrustedContentHint`. Don't echo
  `?partner=`/query params into tool output.
- **Stale closures.** Tools registered once must read latest React state —
  the ref pattern in `useWebMcpTool` covers this; test that
  `select_time_slot` then `get_booking_summary` sees the new slot.
- **Overlap with plans 11/13** (event-type registry, single booking route)
  — same components move. Land those first if they're imminent.

## Decisions

- **Scope.** Open sessions are exposed through WebMCP; `individual` is not.
- **Payment.** `start_payment` is a separate consequential tool, so the agent always
  stops at the summary and the user confirms before the payment form opens.
- **Language.** Descriptions the AI reads (tool and parameter descriptions)
  are English only. Everything a tool returns is in the page language:
  experience names, FAQ, confirmations, warnings and errors.
