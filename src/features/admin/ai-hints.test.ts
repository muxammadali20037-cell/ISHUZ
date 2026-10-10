import { describe, expect, it } from "vitest";
import { aiErrorHint } from "./ai-hints";

describe("aiErrorHint", () => {
  it("Gemini xatolarini tushunarli turga ajratadi", () => {
    expect(aiErrorHint("http_400: API key not valid. Please pass a valid API key.")).toBe("key");
    expect(aiErrorHint("http_429: You exceeded your current quota, please check your plan")).toBe("quota");
    expect(aiErrorHint("http_503: The model is overloaded. Please try again later.")).toBe("busy");
    expect(aiErrorHint("http_404: models/gemini-x is not found for API version v1beta")).toBe("model");
    expect(aiErrorHint("http_403: Generative Language API has not been used in project 123 before or it is disabled")).toBe("permission");
    expect(aiErrorHint("http_400: User location is not supported for the API use.")).toBe("region");
    expect(aiErrorHint("The operation was aborted due to timeout")).toBe("timeout");
    expect(aiErrorHint("SUPABASE_SERVICE_ROLE_KEY sozlanmagan")).toBe("server_key");
    expect(aiErrorHint("invalid_output")).toBeNull();
    expect(aiErrorHint(null)).toBeNull();
  });
});
