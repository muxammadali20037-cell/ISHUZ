import { describe, expect, it } from "vitest";
import { dayKey, fileExtension, formatBytes, formatDuration, groupByDay, mapUrl, parseAttachmentMeta, previewKind, relativeDay } from "./utils";

describe("chat utils", () => {
  it("dayKey Toshkent vaqtida", () => {
    expect(dayKey("2026-09-25T20:30:00Z")).toBe("2026-09-26"); // 01:30 Toshkent
    expect(dayKey("2026-09-25T10:00:00Z")).toBe("2026-09-25");
  });
  it("groupByDay ketma-ket kunlar", () => {
    const g = groupByDay([{ created_at: "2026-09-25T10:00:00Z" }, { created_at: "2026-09-25T12:00:00Z" }, { created_at: "2026-09-26T03:00:00Z" }]);
    expect(g.map((x) => [x.key, x.items.length])).toEqual([
      ["2026-09-25", 2],
      ["2026-09-26", 1],
    ]);
  });
  it("relativeDay", () => {
    const now = new Date("2026-09-26T05:00:00Z");
    expect(relativeDay("2026-09-26", now)).toBe("today");
    expect(relativeDay("2026-09-25", now)).toBe("yesterday");
    expect(relativeDay("2026-09-20", now)).toBeNull();
  });
  it("parseAttachmentMeta", () => {
    expect(parseAttachmentMeta({ name: "a.pdf", size: 10, mime: "application/pdf" })).toEqual({ name: "a.pdf", size: 10, mime: "application/pdf" });
    expect(parseAttachmentMeta("x")).toBeNull();
    expect(parseAttachmentMeta({ size: -1 })).toBeNull();
  });
  it("formatlar", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatDuration(75)).toBe("1:15");
    expect(previewKind("📷")).toBe("image");
    expect(previewKind("Salom")).toBe("text");
    expect(fileExtension("CV.PDF", undefined)).toBe("pdf");
    expect(fileExtension(undefined, "audio/webm;codecs=opus")).toBe("webm");
    expect(mapUrl(41.2753, 69.204)).toBe("https://yandex.uz/maps/?pt=69.204000,41.275300&z=16&l=map");
  });
});
