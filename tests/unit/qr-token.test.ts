import { afterEach, describe, expect, it, vi } from "vitest";
import { createQrToken, createTicket, verifyQrToken, verifyTicket } from "../../src/lib/security/qr-token";

process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
afterEach(() => vi.useRealTimers());

describe("QR token", () => {
  it("creates a verifiable short-lived token", () => {
    expect(verifyQrToken(createQrToken("session-123", 20))?.sessionId).toBe("session-123");
  });
  it("rejects malformed and tampered tokens", () => {
    expect(verifyQrToken("not-a-token")).toBeNull();
    const [body, sig] = createQrToken("s", 20).split(".");
    expect(verifyQrToken(`${body}x.${sig}`)).toBeNull();
    expect(verifyQrToken(`${body}.${sig}.extra`)).toBeNull();
  });
  it("expires after the 20s rotation plus a 10s grace", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T08:00:00Z"));
    const token = createQrToken("s", 20);
    vi.setSystemTime(new Date("2026-11-08T08:00:29Z"));
    expect(verifyQrToken(token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-11-08T08:00:32Z"));
    expect(verifyQrToken(token)).toBeNull();
  });
  it("does not accept a QR token as a check-in ticket (purpose separation)", () => {
    expect(verifyTicket(createQrToken("s", 20))).toBeNull();
    expect(verifyTicket(createTicket("s", "svc"))?.svc).toBe("svc");
  });
});
