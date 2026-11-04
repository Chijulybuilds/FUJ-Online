import { describe, expect, it } from "vitest";
import { createQrToken, verifyQrToken } from "../../src/lib/security/qr-token";

describe("QR token", () => {
  it("creates a verifiable short-lived token", () => {
    process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
    const token = createQrToken("session-123", 20);
    expect(verifyQrToken(token)?.sessionId).toBe("session-123");
  });
  it("rejects malformed tokens", () => {
    process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
    expect(verifyQrToken("not-a-token")).toBeNull();
  });
});
