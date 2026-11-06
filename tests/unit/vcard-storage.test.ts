import { describe, expect, it } from "vitest";
import { toVcf } from "../../src/lib/vcard";
import { sniffImage, isOurFlyerUrl } from "../../src/lib/storage";

describe("contacts export (.vcf)", () => {
  it("writes one vCard per person with the E.164 phone, escaping special characters", () => {
    const out = toVcf([
      { full_name: "Grace Okafor", normalized_phone: "+2348031234567", email: "grace@example.com", username: "flaggrace101" },
      { full_name: "Ada", normalized_phone: "+2348030000000", email: null, username: null }
    ]);
    expect(out.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(out).toContain("FN:Grace Okafor (FUJ)\r\nN:Okafor;Grace;;;\r\nTEL;TYPE=CELL:+2348031234567\r\nEMAIL:grace@example.com");
    expect(out).toContain("N:;Ada;;;");
    expect(toVcf([{ full_name: "A, B; C", normalized_phone: "+1", email: null, username: null }])).toContain(String.raw`FN:A\, B\; C (FUJ)`);
  });
});

describe("flyer uploads", () => {
  it("detects images by their bytes, not their file name", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
  });
  it("only accepts flyer URLs the app produced", () => {
    expect(isOurFlyerUrl("/api/media/123e4567-e89b-12d3-a456-426614174000.png")).toBe(true);
    expect(isOurFlyerUrl("/api/media/../../etc/passwd")).toBe(false);
    expect(isOurFlyerUrl("https://evil.example.com/x.png")).toBe(false);
  });
});
