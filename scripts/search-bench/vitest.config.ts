import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Qidiruv benchmarki — faqat lokal e2e stendga qarshi (CI unit testlariga kirmaydi): npm run bench:search */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/search-bench/bench.test.ts"], root: fileURLToPath(new URL("../..", import.meta.url)), testTimeout: 300_000 },
});
