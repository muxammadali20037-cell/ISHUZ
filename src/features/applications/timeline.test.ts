import { describe, expect, it } from "vitest";
import { actorRole, buildTimeline, sortEvents, systemNote, type TimelineEventLike } from "./timeline";

const W = "worker-profile";
const E = "employer-profile";

function ev(to: TimelineEventLike["to_status"], from: TimelineEventLike["from_status"], at: string, actor: string | null = E, note: string | null = null, id?: number): TimelineEventLike {
  return { id, from_status: from, to_status: to, actor_id: actor, note, created_at: at };
}

describe("buildTimeline", () => {
  it("sent only: first step current, rest upcoming", () => {
    const steps = buildTimeline([ev("sent", null, "2026-09-01T10:00:00Z", W)], "sent");
    expect(steps.map((s) => s.status)).toEqual(["sent", "viewed", "shortlisted", "interview", "offered", "hired"]);
    expect(steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0]).toMatchObject({ at: "2026-09-01T10:00:00Z", actorId: W, implicit: false, terminal: false });
    expect(steps[1]?.at).toBeNull();
  });

  it("no events at all: still renders the pipeline with an implicit current step", () => {
    const steps = buildTimeline([], "sent");
    expect(steps[0]).toMatchObject({ status: "sent", state: "current", implicit: true, at: null });
  });

  it("skipped stages are completed but implicit", () => {
    const steps = buildTimeline(
      [ev("sent", null, "2026-09-01T10:00:00Z", W), ev("viewed", "sent", "2026-09-02T10:00:00Z"), ev("interview", "viewed", "2026-09-03T10:00:00Z", E, "Ertaga 10:00")],
      "interview",
    );
    expect(steps.map((s) => s.state)).toEqual(["completed", "completed", "completed", "current", "upcoming", "upcoming"]);
    expect(steps[2]).toMatchObject({ status: "shortlisted", implicit: true, at: null });
    expect(steps[3]).toMatchObject({ status: "interview", implicit: false, note: "Ertaga 10:00", actorId: E, fromStatus: "viewed" });
  });

  it("hired: every step completed, hired is current", () => {
    const steps = buildTimeline(
      [ev("sent", null, "2026-09-01T10:00:00Z", W), ev("viewed", "sent", "2026-09-02T10:00:00Z"), ev("offered", "viewed", "2026-09-03T10:00:00Z"), ev("hired", "offered", "2026-09-04T10:00:00Z")],
      "hired",
    );
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.state)).toEqual(["completed", "completed", "completed", "completed", "completed", "current"]);
    expect(steps.every((s) => !s.terminal)).toBe(true);
    expect(steps[5]?.at).toBe("2026-09-04T10:00:00Z");
  });

  it("rejected after interview: no upcoming steps, terminal red step appended", () => {
    const steps = buildTimeline(
      [ev("sent", null, "2026-09-01T10:00:00Z", W), ev("viewed", "sent", "2026-09-02T10:00:00Z"), ev("interview", "viewed", "2026-09-03T10:00:00Z"), ev("rejected", "interview", "2026-09-05T10:00:00Z", E, "Boshqa nomzod tanlandi")],
      "rejected",
    );
    expect(steps.map((s) => s.status)).toEqual(["sent", "viewed", "shortlisted", "interview", "rejected"]);
    expect(steps.map((s) => s.state)).toEqual(["completed", "completed", "completed", "completed", "current"]);
    const last = steps[4];
    expect(last).toMatchObject({ terminal: true, note: "Boshqa nomzod tanlandi", fromStatus: "interview", at: "2026-09-05T10:00:00Z" });
    expect(steps.some((s) => s.state === "upcoming")).toBe(false);
  });

  it("withdrawn right after sent: only sent + terminal withdrawn", () => {
    const steps = buildTimeline([ev("sent", null, "2026-09-01T10:00:00Z", W), ev("withdrawn", "sent", "2026-09-01T12:00:00Z", W)], "withdrawn");
    expect(steps.map((s) => s.status)).toEqual(["sent", "withdrawn"]);
    expect(steps[0]?.state).toBe("completed");
    expect(steps[1]).toMatchObject({ terminal: true, state: "current", actorId: W });
  });

  it("terminal without its own event falls back to the furthest reached event", () => {
    const steps = buildTimeline([ev("sent", null, "2026-09-01T10:00:00Z", W), ev("shortlisted", "sent", "2026-09-02T10:00:00Z")], "rejected");
    expect(steps.map((s) => s.status)).toEqual(["sent", "viewed", "shortlisted", "rejected"]);
    expect(steps[3]).toMatchObject({ terminal: true, implicit: true, at: null });
  });

  it("application created from an accepted offer (offered from null) keeps earlier stages implicit", () => {
    const steps = buildTimeline([ev("offered", null, "2026-09-01T10:00:00Z", W, "offer_accepted")], "offered");
    expect(steps.map((s) => s.state)).toEqual(["completed", "completed", "completed", "completed", "current", "upcoming"]);
    expect(steps.slice(0, 4).every((s) => s.implicit)).toBe(true);
    expect(steps[4]).toMatchObject({ note: "offer_accepted", implicit: false });
    expect(systemNote(steps[4]?.note ?? null)).toBe("offer_accepted");
    expect(systemNote("offer_hired")).toBe("offer_hired");
    expect(systemNote("Ertaga keling")).toBeNull();
    expect(systemNote(null)).toBeNull();
  });

  it("sorts unordered events chronologically and uses the latest event per status", () => {
    const steps = buildTimeline(
      [ev("viewed", "sent", "2026-09-02T10:00:00Z", E, null, 2), ev("sent", null, "2026-09-01T10:00:00Z", W, null, 1), ev("viewed", "sent", "2026-09-02T11:00:00Z", E, "again", 3)],
      "viewed",
    );
    expect(steps[0]?.at).toBe("2026-09-01T10:00:00Z");
    expect(steps[1]).toMatchObject({ state: "current", at: "2026-09-02T11:00:00Z", note: "again" });
  });

  it("does not mutate the input", () => {
    const input = [ev("viewed", "sent", "2026-09-02T10:00:00Z"), ev("sent", null, "2026-09-01T10:00:00Z", W)];
    const copy = [...input];
    buildTimeline(input, "viewed");
    expect(input).toEqual(copy);
  });
});

describe("sortEvents", () => {
  it("orders by created_at then id", () => {
    const sorted = sortEvents([ev("viewed", "sent", "2026-09-02T10:00:00Z", E, null, 5), ev("sent", null, "2026-09-02T10:00:00Z", W, null, 4), ev("hired", "viewed", "2026-09-01T10:00:00Z", E, null, 9)]);
    expect(sorted.map((e) => e.id)).toEqual([9, 4, 5]);
  });
});

describe("actorRole", () => {
  it("maps actor to worker / employer / system", () => {
    expect(actorRole(W, W)).toBe("worker");
    expect(actorRole(E, W)).toBe("employer");
    expect(actorRole(null, W)).toBe("system");
    expect(actorRole(E, null)).toBe("employer");
  });
});
