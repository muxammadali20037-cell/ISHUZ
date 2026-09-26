import { describe, expect, it } from "vitest";
import {
  parseWorkerSearchParams,
  serializeWorkerSearchParams,
  buildWorkersUrl,
  countActiveFilters,
  clearFilters,
  DEFAULT_STATUSES,
  EMPTY_WORKER_SEARCH,
} from "./search-params";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

describe("parseWorkerSearchParams", () => {
  it("returns defaults for empty input", () => {
    const p = parseWorkerSearchParams({});
    expect(p.q).toBeNull();
    expect(p.status).toEqual(DEFAULT_STATUSES);
    expect(p.sort).toBe("relevant");
    expect(p.page).toBe(1);
    expect(p.district).toEqual([]);
    expect(p.remote).toBeNull();
    expect(p.portfolio).toBe(false);
  });

  it("parses csv lists, filters invalid values and dedupes", () => {
    const p = parseWorkerSearchParams({
      schedule: "5_2,weird,6_1,5_2",
      employment: "full_time, part_time",
      languages: "ru,EN,123,ru",
      district: `${U1},${U2},not-a-uuid`,
      skills: `${U1},${U1}`,
      availability: "today,never",
      status: "open",
    });
    expect(p.schedule).toEqual(["5_2", "6_1"]);
    expect(p.employment).toEqual(["full_time", "part_time"]);
    expect(p.languages).toEqual(["ru", "en"]);
    expect(p.district).toEqual([U1, U2]);
    expect(p.skills).toEqual([U1]);
    expect(p.availability).toEqual(["today"]);
    expect(p.status).toEqual(["open"]);
  });

  it("falls back to default statuses when all provided statuses are invalid", () => {
    expect(parseWorkerSearchParams({ status: "bogus" }).status).toEqual(DEFAULT_STATUSES);
  });

  it("parses numbers with bounds", () => {
    const p = parseWorkerSearchParams({ experience_min: "12", salary_max: "5000000", page: "3", max_km: "10" });
    expect(p.experience_min).toBe(12);
    expect(p.salary_max).toBe(5_000_000);
    expect(p.page).toBe(3);
    expect(p.max_km).toBe(10);
    const bad = parseWorkerSearchParams({ experience_min: "-1", salary_max: "abc", page: "0", max_km: "999" });
    expect(bad.experience_min).toBeNull();
    expect(bad.salary_max).toBeNull();
    expect(bad.page).toBe(1);
    expect(bad.max_km).toBeNull();
  });

  it("parses enums, flags and tri-state remote", () => {
    const p = parseWorkerSearchParams({ format: "official", gender: "female", education_min: "higher", portfolio: "1", verified: "true", remote: "0", sort: "newest" });
    expect(p.format).toBe("official");
    expect(p.gender).toBe("female");
    expect(p.education_min).toBe("higher");
    expect(p.portfolio).toBe(true);
    expect(p.verified).toBe(true);
    expect(p.remote).toBe(false);
    expect(p.sort).toBe("newest");
    expect(parseWorkerSearchParams({ remote: "1" }).remote).toBe(true);
    expect(parseWorkerSearchParams({ format: "x", sort: "y" })).toMatchObject({ format: null, sort: "relevant" });
  });

  it("requires both lat and lng", () => {
    expect(parseWorkerSearchParams({ lat: "41.3" })).toMatchObject({ lat: null, lng: null });
    expect(parseWorkerSearchParams({ lat: "41.3", lng: "69.2" })).toMatchObject({ lat: 41.3, lng: 69.2 });
    expect(parseWorkerSearchParams({ lat: "91", lng: "69.2" })).toMatchObject({ lat: null, lng: null });
  });

  it("validates slugs and uuids", () => {
    expect(parseWorkerSearchParams({ category: "sales", vacancy: U1 })).toMatchObject({ category: "sales", vacancy: U1 });
    expect(parseWorkerSearchParams({ category: "bad slug!", vacancy: "nope" })).toMatchObject({ category: null, vacancy: null });
  });

  it("accepts URLSearchParams and array values", () => {
    const a = parseWorkerSearchParams(new URLSearchParams("q=kassir&category=sales"));
    expect(a).toMatchObject({ q: "kassir", category: "sales" });
    const b = parseWorkerSearchParams({ q: ["first", "second"] });
    expect(b.q).toBe("first");
  });

  it("trims and limits q", () => {
    expect(parseWorkerSearchParams({ q: "   " }).q).toBeNull();
    expect(parseWorkerSearchParams({ q: "x".repeat(200) }).q?.length).toBe(100);
  });
});

describe("serializeWorkerSearchParams", () => {
  it("omits defaults", () => {
    expect(serializeWorkerSearchParams(EMPTY_WORKER_SEARCH)).toBe("");
    expect(serializeWorkerSearchParams({ ...EMPTY_WORKER_SEARCH, status: ["open", "active"] })).toBe("");
  });

  it("round-trips", () => {
    const p = parseWorkerSearchParams({
      q: "kassir",
      category: "sales",
      subcategory: "cashier",
      region: "tashkent_city",
      district: `${U1},${U2}`,
      experience_min: "12",
      salary_max: "7000000",
      schedule: "5_2,6_1",
      employment: "full_time",
      format: "official",
      gender: "male",
      education_min: "vocational",
      languages: "ru,en",
      skills: U1,
      status: "active,open,not_looking",
      availability: "today,tomorrow",
      portfolio: "1",
      verified: "1",
      remote: "1",
      vacancy: U2,
      lat: "41.31123",
      lng: "69.27987",
      max_km: "10",
      sort: "distance",
      page: "2",
    });
    const qs = serializeWorkerSearchParams(p);
    const back = parseWorkerSearchParams(new URLSearchParams(qs));
    expect(back).toEqual({ ...p, lat: 41.3112, lng: 69.2799 });
  });
});

describe("buildWorkersUrl / helpers", () => {
  it("resets page when filters change", () => {
    const base = parseWorkerSearchParams({ page: "4", category: "sales" });
    expect(buildWorkersUrl(base, { region: "samarkand" })).toBe("/workers?category=sales&region=samarkand");
    expect(buildWorkersUrl(base, { page: 2 })).toBe("/workers?category=sales&page=2");
    expect(buildWorkersUrl(EMPTY_WORKER_SEARCH, {})).toBe("/workers");
  });

  it("counts active filters", () => {
    expect(countActiveFilters(EMPTY_WORKER_SEARCH)).toBe(0);
    const p = parseWorkerSearchParams({ category: "sales", schedule: "5_2", portfolio: "1", status: "not_looking", q: "x", sort: "newest", vacancy: U1 });
    expect(countActiveFilters(p)).toBe(4);
  });

  it("clears filters but keeps q, vacancy and coordinates", () => {
    const p = parseWorkerSearchParams({ q: "kassir", vacancy: U1, category: "sales", lat: "41", lng: "69", max_km: "5", sort: "distance", page: "3" });
    const c = clearFilters(p);
    expect(c).toMatchObject({ q: "kassir", vacancy: U1, category: null, lat: 41, lng: 69, max_km: null, sort: "distance", page: 1 });
    const noCoords = clearFilters(parseWorkerSearchParams({ sort: "distance" }));
    expect(noCoords.sort).toBe("relevant");
  });
});
