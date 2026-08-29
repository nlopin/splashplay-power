# Booking via ChatGPT — Research & Plan

_Researched 2026-08-26. The agentic commerce ecosystem moves fast; re-verify gated features before starting Phase 2._
_Status update 2026-08-30: Phase 0 shipped, Phase 1's text-only path shipped (widget deferred — see Phase 1 note). Both landed on `stripe-agentic-payment` in commit `b330e43`; see that phase's tasks below for what's done vs. open._

## Verdict

**In-chat payment via Stripe's agentic protocol is real and documented, but gated.** The full flow — user books and pays without leaving ChatGPT — exists today as: ChatGPT App (Apps SDK) → `window.openai.requestCheckout()` → ChatGPT payment sheet → Stripe **Shared Payment Token (SPT)** → merchant charges via PaymentIntent. Stripe's SPT preview explicitly supports sellers in **Spain (ES)** and the EU. However, OpenAI's payment sheet is currently **private beta, limited to select marketplaces, and approved for physical goods only** ("actively working to support a wider range of commerce use cases").

**The fallback is the officially recommended path today**: OpenAI's own monetization docs state that for most developers, *external checkout* (redirect to your own domain) is the standard approach. That is exactly our Stripe Checkout page.

So the pragmatic plan stands: ship a ChatGPT booking app with Stripe-hosted Checkout now (Phase 1), build the in-chat payment layer behind access applications (Phase 2). ~90% of the work is shared between the two.

## State of the ecosystem (Aug 2026)

- **Instant Checkout (product-feed checkout) was sidelined in March 2026.** OpenAI: "Instant Checkout is moving to Apps, where purchases can happen more seamlessly." Only ~12 merchants ever went live with it. **ChatGPT Apps are now the commerce surface** — Target, DoorDash, Instacart launched apps. This settles our surface question: **build a ChatGPT App (Apps SDK / MCP)**, not an ACP product feed.
- **Agentic Commerce Protocol (ACP)** — open standard by Stripe + OpenAI (+ Meta) — remains the backbone. Latest stable spec snapshot 2026-04-17; the Agentic Checkout Spec used by ChatGPT is versioned 2025-09-12. Fulfillment supports **digital and service types — shipping is optional**, so date-based bookings fit the session model.
- **Stripe SPT**: preview (API version `2026-04-22.preview`, seller-services preview terms). Supported seller countries include **ES** and most of the EU/EEA. Charge flow: `POST /v1/payment_intents` with `payment_method_data[shared_payment_granted_token]=spt_...`, `confirm=true`. Tokens are scoped (max amount, currency, expiry) and single-transaction.
- **ChatGPT payment sheet** (in-chat payment UI): private beta, select marketplaces, **physical goods only** for now. Supported PSPs: Stripe, Adyen, Checkout.com, Fiserv, PayPal, Worldpay. Test mode via `payment_mode: "test"` + `4242` card.
- **App submission**: open to all developers; review takes 5–10 business days; needs privacy policy URL, support email, icon, screenshots. **Appointment booking for physical services and reservations are explicitly allowed** app categories.
- **Geography caveat**: Apps in ChatGPT launched **excluding the EEA, Switzerland, and the UK**, and as of Aug 2026 EEA availability is still rolling out (OpenAI says "soon"; DSA scrutiny is the blocker). Implication for us: **tourists on non-EEA accounts (US, UK pending, etc.) can use the app; local Barcelona users on EEA accounts may not see it yet.** For a tourist-heavy business this is less painful than it sounds, but track the rollout.
- **Bonus route (non-ChatGPT agents)**: Stripe's Machine Payments Protocol (MPP) monetization guide targets exactly our case ("service bookings") for agents like Claude: MCP tool returns a payment link; agent POSTs → HTTP 402 challenge → pays with SPT; a browser opening the same link redirects to normal checkout. Same backend, extra distribution. Optional Phase 3.

## Why our existing pipeline fits almost perfectly

Current flow ([src/pages/api/payment-session.ts](../src/pages/api/payment-session.ts), [src/pages/api/stripe-webhook.ts](../src/pages/api/stripe-webhook.ts), [src/services/calendly.ts](../src/services/calendly.ts)):

1. Client picks experience + slot → `POST /api/payment-session` creates an **embedded** Stripe Checkout Session; metadata carries `eventType`, `sessionTime`, `sessionTitle`, `guests`, `partner`.
2. `checkout.session.completed` webhook → `bookEvent()` → **Calendly `POST /invitees`** (programmatic booking, no widget) → Telegram notification.

The booking side is already fully headless — payment is the only human-facing step. Any agent flow that produces a paid Stripe object with the same metadata rides the existing pipeline untouched. Availability is likewise already an API (`GET /api/availability?type=...` → Calendly `event_type_available_times`).

### ⚠️ Existing API state (verified in production, 2026-08-26)

The two GET endpoints the agent flow would build on are **currently broken in production** — both are missing `export const prerender = false`, so Astro prerenders them at build time (the project uses static output + Netlify adapter; only routes that opt out become serverless functions):

- `GET /api/availability?type=friends` → always returns the build-time-baked `{"error":"invalid or missing event type"}` with HTTP 200. Query params don't exist at build time, so the error response was rendered into a 41-byte static file (`dist/api/availability`).
- `GET /api/get-session-status` → always 404. At build time `session_id` is absent, the handler returns 404, so no static file was emitted at all.

Neither endpoint has any consumer in the codebase today (booking pages call `getAvailability()` server-side with `prerender = false`; `complete.astro` retrieves the Stripe session directly), which is why the site works and nobody noticed. The POST/webhook routes (`payment-session`, `stripe-webhook`, `calendly-webhook`) all have the flag and work.

**Fix**: add `export const prerender = false;` to `src/pages/api/availability.ts` and `src/pages/api/get-session-status.ts`. Lesson for Phase 0: every new API route must set it, and production smoke tests must assert real data, not just HTTP 200 (the availability bug returns 200 with an error body).

## Plan

### Phase 0 — MCP server + booking tools (shared foundation)

Stand up an MCP server (Streamable HTTP) on Netlify alongside the site. Tools:

| Tool | Backing | Notes |
|---|---|---|
| `list_experiences` | static catalog | name, description, price, duration, guest min/max, language — source from existing i18n content so ChatGPT answers questions accurately |
| `check_availability` | existing `getAvailability(eventType)` | return slots; let the model negotiate dates conversationally |
| `create_booking_checkout` | new variant of payment-session | **hosted** Checkout Session (drop `ui_mode: "embedded"`, use `success_url`/`cancel_url`) with identical metadata → existing webhook completes Calendly booking + Telegram, zero changes |
| `get_booking_status` | existing `get-session-status` | lets the widget/model confirm "you're booked" after payment |

Also an FAQ/policies resource (location, what to wear, cancellation policy) so the agent answers questions from our content, not hallucination.

Tasks:
- [x] **Verify + fix existing API routes**: `prerender = false` added to `availability.ts` and `get-session-status.ts` (commit `1945c95`)
- [x] Production smoke-test script for all API routes — `scripts/smoke-test-api.ts` (`pnpm smoke-test`), asserts response shape not just status
- [x] MCP server endpoint — `src/pages/api/mcp.ts` (Streamable HTTP, `@modelcontextprotocol/sdk`), stateless per-request server
- [x] Extract hosted-checkout variant from `payment-session.ts` — `src/services/checkout/createCheckoutSession.ts` exports `createEmbeddedCheckoutSession`/`createHostedCheckoutSession` off one shared `baseSessionParams`
- [x] Catalog + FAQ content module — `src/services/catalog/*` (experiences, pricing, product names), `src/services/catalog/faq.ts`
- [x] Auth/rate-limiting on MCP endpoint — `src/services/mcp/rateLimit.ts`, fixed-window per-IP via Netlify Blobs, fails open

**Not yet deployed as of 2026-08-30**: this all landed on branch `stripe-agentic-payment`, not `main`. Production `/api/mcp` still 404s until it merges and deploys.

### Phase 1 — ChatGPT App with external checkout (ships first; the fallback plan)

- ~~Apps SDK widget: experience picker → date/time slots → guest count → summary card.~~ **Descoped for this pass (decided 2026-08-30)**: ChatGPT can already drive the full booking flow conversationally over the four plain-text/JSON MCP tools (`list_experiences`, `check_availability`, `create_booking_checkout`, `get_booking_status`) — no visual component required to be functional. The widget becomes a fast-follow once the text-only flow is proven live.
- Payment: `create_booking_checkout` returns the Stripe-hosted Checkout URL; the app opens it as an external link (OpenAI's recommended pattern). `success_url` → existing `/complete` page; call `get_booking_status` afterwards to confirm. **Done** — `mcp.ts` implements exactly this.
- Submit to the app directory: privacy policy URL (page exists — `src/pages/[lang]/privacy-policy.astro`), support email, 512×512 icon, screenshots; review 5–10 business days. Category: reservations/appointment booking (allowed). **Assets/submission are the user's own to gather — not scripted here.**
- Accept the EEA caveat; monitor OpenAI's EU apps rollout.

Tasks:
- [ ] Widget UI (Apps SDK component; slot picker, summary, confirmation states) — **deferred, see above**
- [x] External checkout hand-off + return handling — hosted Checkout session → `success_url`/`cancel_url`, `/complete` page reads `session_id` standalone (no embedding assumptions), `get_booking_status` MCP tool for post-payment confirmation
- [x] Privacy policy page shipped; support email/icon/screenshots still needed from the user
- [ ] Merge `stripe-agentic-payment` → `main` and deploy (blocking — prod doesn't serve `/api/mcp` yet)
- [ ] End-to-end test in ChatGPT developer mode; submit for review — manual, after deploy

### Phase 2 — In-chat payment via SPT (the target experience; gated)

Prerequisites (apply for both in parallel while Phase 1 ships):
- **Stripe**: SPT seller preview access — accept the agentic-commerce seller preview terms, create Stripe profile (network ID). Spain/EUR supported.
- **OpenAI**: ChatGPT payment sheet access — private beta, select marketplaces, physical goods only today. Our case (payable service bookings) is in the "wider range of commerce use cases" they say is coming. Apply and wait; there is no self-serve path as of Aug 2026.

Build (can be developed and tested with `payment_mode: "test"` before GA access):
- ACP Agentic Checkout endpoints (spec 2025-09-12): `POST /checkout_sessions`, `POST /checkout_sessions/{id}`, `POST /checkout_sessions/{id}/complete`, `POST /checkout_sessions/{id}/cancel`, `GET /checkout_sessions/{id}`. Fulfillment type: service/digital (no shipping). Currency `eur`. Headers: `Authorization`, `Signature`, `Idempotency-Key`, `Timestamp`.
- Widget calls `window.openai.requestCheckout(session_data)` → ChatGPT payment sheet → our MCP `complete_checkout` tool receives the SPT.
- Charge: PaymentIntent with `payment_method_data[shared_payment_granted_token]`, `Stripe-Version: 2026-04-22.preview`, amount/currency within the token's scoped limits.
- Booking completion: extract the `checkout.session.completed` handler body (metadata parse → `bookEvent()` → Telegram) into a shared function; call it from a new `payment_intent.succeeded` path (or directly after confirming the PaymentIntent) so both payment shapes converge on one pipeline.
- Slot hold: put a short TTL hold on the Calendly slot between session create and completion (today the embedded flow has the same race — payment succeeds but slot gone → `calendly_booking_failed`; the agent flow makes this window longer, so at minimum re-validate availability at `/complete` and fail the checkout with an ACP error message rather than charging).

### Phase 3 (optional) — non-ChatGPT agents via MPP

Reuse the same catalog/availability logic behind a Stripe MPP endpoint (402-challenge flow): Claude and other MCP-capable agents can book and pay with Link-wallet SPTs; browsers hitting the same link fall back to hosted Checkout. Listing in the Stripe Directory makes it discoverable. Cheap to add once Phase 2's SPT charging exists.

## Risks & open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Payment sheet stays physical-goods-only / invite-only longer than hoped | Phase 2 blocked | Phase 1 is fully functional without it; build Phase 2 against test mode |
| Apps not yet GA in EEA | Local users can't use the app | Tourist segment unaffected; monitor rollout; site remains primary channel |
| Stripe SPT is preview API (`2026-04-22.preview`) | Breaking changes | Pin version header; small charge-path surface to update |
| Slot race: pay-then-book can fail | Charged user, no booking (exists today too) | Availability re-check at complete; refund path; consider Calendly hold |
| ACP spec churn (2025-09-12 checkout vs 2026-04-17 protocol snapshots) | Rework | Endpoints are thin adapters over our session helper |
| App review rejection | Delay | Guidelines allow reservation apps; ensure completeness, privacy policy, all-audiences content |

Open questions:
- Refund/cancellation flow in-chat: ACP has order webhooks for refunds — wire to existing cancellation handling? (Phase 2 scope decision.)
- Which languages does the app target? Model handles conversation language automatically; catalog strings exist in EN/ES/CA/(?) — reuse i18n.
- Partner attribution (`partner` metadata): does agent-referred booking count as a new "channel" for analytics? Suggest a `chatgpt` partner-like source tag.

## Sources

- [OpenAI: Buy it in ChatGPT — Instant Checkout & ACP](https://openai.com/index/buy-it-in-chatgpt/)
- [Digital Commerce 360: OpenAI shifts checkout plans (Mar 2026)](https://www.digitalcommerce360.com/2026/03/06/openai-shifts-checkout-plans-agentic-commerce-strategy/)
- [OpenAI Developers: Agentic Commerce key concepts](https://developers.openai.com/commerce/guides/key-concepts)
- [OpenAI Developers: Agentic Checkout Spec](https://developers.openai.com/commerce/specs/checkout)
- [OpenAI Developers: Apps SDK — Monetization / Checkout API](https://developers.openai.com/apps-sdk/build/monetization)
- [OpenAI Developers: App submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)
- [OpenAI: Introducing apps in ChatGPT and the Apps SDK](https://openai.com/index/introducing-apps-in-chatgpt/)
- [OpenAI: Developers can now submit apps to ChatGPT](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)
- [Stripe Docs: Agentic commerce overview](https://docs.stripe.com/agentic-commerce)
- [Stripe Docs: Agentic Commerce Protocol](https://docs.stripe.com/agentic-commerce/acp)
- [Stripe Docs: Shared payment tokens (seller)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens)
- [Stripe Docs: Monetize your MCP server (MPP)](https://docs.stripe.com/agentic-commerce/apps/accept-payment)
- [Stripe Newsroom: Stripe powers Instant Checkout in ChatGPT](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- [ACP specification](https://agenticcommerce.dev) · [GitHub repo](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
