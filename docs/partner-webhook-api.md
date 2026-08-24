# Partner Booking Webhook — API Reference

This document describes the webhook SplashPlay sends to partners when a
referred booking is created or cancelled, and the test endpoint partners can
use to verify their receiver before going live.

## 1. Events

We send a `POST` request to your registered `webhookUrl` for two events:

| Event | Sent when |
|---|---|
| `booking.created` | A referred visitor completes a paid booking |
| `booking.cancelled` | A previously-created booking is cancelled |

## 2. Payload

```jsonc
{
  "event": "booking.created",           // or "booking.cancelled"
  "bookingId": "pi_3PxYzABC123",         // stable id, same value on create and cancel for the same booking
  "sessionTitle": "Creative Session",
  "scheduledTime": "2026-09-01T11:00:00.000Z",
  "guestName": "Jane Doe",
  "createdAt": "2026-08-23T09:12:03.000Z" // when this event was generated
}
```

All fields are always present. `bookingId` is the correlation key — use it to
match a `booking.cancelled` event to the `booking.created` event it cancels.

## 3. Verifying the signature

Every request carries a `Partner-Webhook-Signature` header:

```
Partner-Webhook-Signature: t=1787418467,v1=a4e51409593d88c8fa5c0ff0c5effa3aa78c7bbef2e67dac18c478d098c7acab
```

- `t` — Unix timestamp (seconds) the request was signed at.
- `v1` — HMAC-SHA256, hex-encoded, computed over `"{t}.{raw request body}"`
  using the secret we shared with you out of band.

Verify it by recomputing the same HMAC and comparing with a constant-time
comparison. Node.js example:

```js
import crypto from "node:crypto";

function isValidSignature(rawBody, signatureHeader, secret) {
  const [tPart, v1Part] = signatureHeader.split(",");
  const timestamp = tPart.replace("t=", "");
  const provided = v1Part.replace("v1=", "");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
```

Use the *raw* request body (bytes as received, before any JSON re-parsing) —
re-serializing the parsed object can change formatting and break the
comparison.

## 4. Delivery semantics

- We wait up to **5 seconds** for your endpoint to respond. Respond quickly;
  do slow work (your own DB writes, etc.) after responding, not before.
- Respond with any `2xx` status to acknowledge.
- **We do not retry failed deliveries in v1.** If your endpoint is down or
  times out, that event is not resent automatically — talk to us if you
  suspect you're missing events.

## 5. Test endpoint

Before going live, use this endpoint to confirm your receiver correctly
verifies signatures and parses the payload. It sends you a real, signed
webhook with synthetic data — no real booking is created on our side.

```
POST https://splashplay.es/api/partners/test-webhook
Authorization: Bearer <your secret>
Content-Type: application/json
```

**Send a test `booking.created`:**

```bash
curl -X POST https://splashplay.es/api/partners/test-webhook \
  -H "Authorization: Bearer <your secret>" \
  -H "Content-Type: application/json" \
  -d '{"partnerKey": "<your partner key>"}'
```

**Send a test `booking.cancelled`** (reference a `bookingId` from a prior
test call, or make one up):

```bash
curl -X POST https://splashplay.es/api/partners/test-webhook \
  -H "Authorization: Bearer <your secret>" \
  -H "Content-Type: application/json" \
  -d '{"partnerKey": "<your partner key>", "bookingId": "test_abc123", "status": "cancel"}'
```

**Response:**

```jsonc
{
  "delivered": true,
  "event": "booking.created",
  "bookingId": "test_9f1c2e3a-..." // generated for you if you didn't send one
}
```

| Status | Meaning |
|---|---|
| `200` | Delivered to your `webhookUrl` — check your receiver logs |
| `400` | Bad request (e.g. `status: "cancel"` without a `bookingId`) |
| `401` | Unknown `partnerKey` or wrong secret |
| `502` | We reached your endpoint but delivery failed (non-2xx or timeout) — the response body's `error` field has details |

## 6. Getting your credentials

Your `partnerKey`, `secret`, and registered `webhookUrl` are issued to you
directly by SplashPlay — contact us to onboard or to rotate your secret.
