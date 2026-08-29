/**
 * Production smoke test for the API routes.
 *
 * Asserts response *shape*, not just HTTP status — the bug this exists to catch
 * (see specs/chatgpt-booking.md) was `/api/availability` returning 200 with an
 * error body, and `/api/get-session-status` always 404, because both routes
 * were being prerendered at build time instead of running as functions.
 *
 * Usage:
 *   tsx scripts/smoke-test-api.ts [baseUrl]
 *   SMOKE_TEST_BASE_URL=https://deploy-preview--x.netlify.app tsx scripts/smoke-test-api.ts
 */

const baseUrl =
  process.argv[2] ?? process.env.SMOKE_TEST_BASE_URL ?? "https://splashplay.es";

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

async function check(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(res: Response): Promise<any> {
  return res.json();
}

async function main() {
  console.log(`Smoke testing ${baseUrl}\n`);

  await check("GET /api/availability?type=friends returns real slots, not a baked-in error", async () => {
    const res = await fetch(`${baseUrl}/api/availability?type=friends`);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await readJson(res);
    assert(
      Array.isArray(body),
      `expected an array of slots, got ${JSON.stringify(body).slice(0, 200)} — ` +
        `this is exactly the prerender bug (200 + {"error":...})`,
    );
    if (body.length > 0) {
      const first = body[0] as { time?: unknown };
      assert(typeof first.time === "string", "slot is missing a 'time' field");
    }
  });

  await check("GET /api/availability?type=bogus rejects an unknown event type", async () => {
    const res = await fetch(`${baseUrl}/api/availability?type=bogus`);
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await check("GET /api/get-session-status (no session_id) returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/get-session-status`);
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  await check("GET /api/get-session-status?session_id=... is live (not statically baked to 404)", async () => {
    // Note: `astro dev` locally turns the uncaught Stripe "no such session" error into a
    // bare 404 too (an unrelated dev-server quirk, present before this route existed) —
    // this check is only meaningful against a real deploy, which is its default target.
    const res = await fetch(
      `${baseUrl}/api/get-session-status?session_id=cs_test_smoke_test_nonexistent`,
    );
    assert(
      res.status !== 404,
      "got 404 for a request WITH a session_id — this is exactly the prerender bug " +
        "(the route was baked to always 404 regardless of query params)",
    );
  });

  await check("POST /api/payment-session rejects an invalid body without calling Stripe", async () => {
    const res = await fetch(`${baseUrl}/api/payment-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
    const body = await readJson(res);
    assert("error" in body, "expected a validation error body");
  });

  await check("POST /api/stripe-webhook rejects an unsigned request", async () => {
    const res = await fetch(`${baseUrl}/api/stripe-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await check("POST /api/calendly-webhook rejects an unsigned request", async () => {
    const res = await fetch(`${baseUrl}/api/calendly-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check("GET /api/mcp rejects with a JSON-RPC method-not-allowed error", async () => {
    const res = await fetch(`${baseUrl}/api/mcp`);
    assert(res.status === 405, `expected 405, got ${res.status}`);
    const body = await readJson(res);
    assert(body.jsonrpc === "2.0" && body.error, "expected a JSON-RPC error body");
  });

  await check("POST /api/mcp answers an MCP initialize handshake", async () => {
    const res = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "0.0.0" },
        },
      }),
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await readJson(res);
    assert(
      body.result?.serverInfo?.name === "splashplay-booking",
      `unexpected initialize response: ${JSON.stringify(body).slice(0, 300)}`,
    );
  });

  console.log("");
  let failures = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(`✓ ${result.name}`);
    } else {
      failures++;
      console.log(`✗ ${result.name}\n  ${result.detail}`);
    }
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
