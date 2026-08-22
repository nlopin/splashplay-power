import * as crypto from "crypto";
import { describe, expect, it } from "vitest";
import { signPartnerPayload } from "./webhook";

describe("signPartnerPayload", () => {
  it("produces the t=<ts>,v1=<hex> shape", () => {
    const signature = signPartnerPayload('{"a":1}', "secret");

    expect(signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it("signature verifies against a manually computed HMAC", () => {
    const body = '{"event":"booking.created"}';
    const secret = "topsecret";

    const signature = signPartnerPayload(body, secret);
    const [tPart, v1Part] = signature.split(",");
    const timestamp = tPart.replace("t=", "");
    const providedSignature = v1Part.replace("v1=", "");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(providedSignature).toBe(expected);
  });

  it("produces different signatures for different secrets", () => {
    const body = '{"event":"booking.created"}';

    const a = signPartnerPayload(body, "secret-a").split(",")[1];
    const b = signPartnerPayload(body, "secret-b").split(",")[1];

    expect(a).not.toBe(b);
  });
});
