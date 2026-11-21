import { describe, expect, it } from "vitest";
import { bucketSlug, masterBucket, parseBucket, vacancyBucket, workerBucket } from "./listing-buckets";

describe("E'lonlarim yorliqlari", () => {
  it("vakansiya holatlari", () => {
    expect(["active", "pending_review", "draft", "rejected"].map(vacancyBucket)).toEqual(["active", "active", "active", "active"]);
    expect(["paused", "closed", "hidden"].map(vacancyBucket)).toEqual(["closed", "closed", "closed"]);
    expect(vacancyBucket("expired")).toBe("expired");
  });

  it("ish izlovchi e'loni", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(workerBucket({ status: "listed", listedUntil: null, moderationState: "listed" }, now)).toBe("active");
    expect(workerBucket({ status: "payment_required", listedUntil: "2026-11-01T00:00:00Z", moderationState: "payment_required" }, now)).toBe("expired");
    expect(workerBucket({ status: "stopped", listedUntil: "2026-11-01T00:00:00Z", moderationState: "saved" }, now)).toBe("expired");
    expect(workerBucket({ status: "stopped", listedUntil: "2026-12-01T00:00:00Z", moderationState: "saved" }, now)).toBe("closed");
    expect(workerBucket({ status: "stopped", listedUntil: null, moderationState: "saved" }, now)).toBe("closed");
    expect(workerBucket({ status: "stopped", listedUntil: null, moderationState: "review" }, now)).toBe("active");
  });

  it("usta e'loni", () => {
    expect(masterBucket("active")).toBe("active");
    expect(masterBucket("pending_review")).toBe("active");
    expect(masterBucket("paused")).toBe("closed");
  });

  it("URL qiymati", () => {
    expect(parseBucket(undefined)).toBe("active");
    expect(parseBucket("yopilgan")).toBe("closed");
    expect(parseBucket(["tugagan"])).toBe("expired");
    expect(parseBucket("boshqa")).toBe("active");
    expect(bucketSlug("expired")).toBe("tugagan");
  });
});
