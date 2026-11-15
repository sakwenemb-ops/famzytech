import { describe, expect, it } from "vitest";
import { FILE_RULES, sniff } from "@/lib/file-rules";
import { decrypt, encrypt } from "@/server/crypto";

const bytes = (...b: (number | string)[]) =>
  new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniff", () => {
  it.each([
    [bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    [bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a), "image/png"],
    [bytes("RIFF", 0, 0, 0, 0, "WEBP"), "image/webp"],
    [bytes("%PDF-1.7"), "application/pdf"],
    [bytes(0x1a, 0x45, 0xdf, 0xa3), "video/webm"],
    [bytes(0, 0, 0, 0x20, "ftypisom"), "video/mp4"],
    [bytes(0, 0, 0, 0x14, "ftypqt  "), "video/quicktime"],
  ])("detects %#", (b, type) => expect(sniff(b)).toBe(type));

  it("rejects unknown content, whatever the file is called", () => {
    expect(sniff(bytes("<html><script>"))).toBeNull();
    expect(sniff(bytes("MZ"))).toBeNull(); // Windows program
  });
});

describe("file rules", () => {
  it("keeps identity documents and certificates private and encrypted", () => {
    for (const k of ["ID_FRONT", "ID_BACK", "ID_SELFIE", "CERTIFICATE", "DEGREE"] as const) {
      expect(FILE_RULES[k]).toMatchObject({ private: true, encrypt: true });
    }
    expect(FILE_RULES.PROFILE_PHOTO).toMatchObject({ private: false });
  });
});

describe("encryption", () => {
  it("round-trips and detects tampering", () => {
    process.env.FILE_ENCRYPTION_KEY = "test-key";
    const plain = Buffer.from("passport scan");
    const enc = encrypt(plain);
    expect(enc.includes(plain)).toBe(false);
    expect(decrypt(enc).toString()).toBe("passport scan");
    enc[enc.length - 1] ^= 1;
    expect(() => decrypt(enc)).toThrow();
  });
});
