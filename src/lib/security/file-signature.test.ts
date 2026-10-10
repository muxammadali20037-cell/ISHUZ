import { describe, expect, it } from "vitest";
import { contentMatches, mimeFromPath, sniffMime } from "./file-signature";

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === "string" ? Array.from(x, (c) => c.charCodeAt(0)) : [x])));

const PNG = bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, "IHDR");
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, "JFIF");
const WEBP = bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 ");
const PDF = bytes("%PDF-1.7\n");
const HTML = bytes("<!doctype html><script>alert(1)</script>");
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');

describe("sniffMime", () => {
  it("rasm va hujjat imzolarini aniqlaydi", () => {
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(JPEG)).toBe("image/jpeg");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(bytes("GIF89a", 1, 0))).toBe("image/gif");
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(bytes(0x50, 0x4b, 0x03, 0x04, 20, 0))).toBe("application/zip");
    expect(sniffMime(bytes("OggS", 0))).toBe("audio/ogg");
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
    expect(sniffMime(bytes("ID3", 4, 0))).toBe("audio/mpeg");
  });

  it("HTML, SVG, bo'sh va qisqa mazmun — noma'lum", () => {
    expect(sniffMime(HTML)).toBeNull();
    expect(sniffMime(SVG)).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
    expect(sniffMime(bytes(0x89, "PN"))).toBeNull();
    expect(sniffMime(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull();
  });
});

describe("contentMatches", () => {
  it("e'lon qilingan tur mazmunga mos bo'lsa — true", () => {
    expect(contentMatches("image/png", PNG)).toBe(true);
    expect(contentMatches("image/jpeg; charset=binary", JPEG)).toBe(true);
    expect(contentMatches("application/pdf", PDF)).toBe(true);
  });

  it("niqoblangan fayl (png deb HTML, jpeg deb PNG, pdf deb rasm) — false", () => {
    expect(contentMatches("image/png", HTML)).toBe(false);
    expect(contentMatches("image/png", SVG)).toBe(false);
    expect(contentMatches("image/jpeg", PNG)).toBe(false);
    expect(contentMatches("application/pdf", JPEG)).toBe(false);
  });

  it("noma'lum e'lon qilingan tur — false (deny-by-default)", () => {
    expect(contentMatches("image/svg+xml", SVG)).toBe(false);
    expect(contentMatches("text/html", HTML)).toBe(false);
    expect(contentMatches("", PNG)).toBe(false);
  });
});

describe("mimeFromPath", () => {
  it("kengaytmadan tur", () => {
    expect(mimeFromPath("u/abc.PNG")).toBe("image/png");
    expect(mimeFromPath("u/abc.jpeg")).toBe("image/jpeg");
    expect(mimeFromPath("u/abc.pdf")).toBe("application/pdf");
    expect(mimeFromPath("u/abc.svg")).toBeNull();
    expect(mimeFromPath("u/abc")).toBeNull();
  });
});
