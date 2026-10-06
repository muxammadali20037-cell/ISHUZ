import type { MetadataRoute } from "next";
import { getServerEnv } from "@/lib/env";

/** Qidiruv tizimlari: ommaviy sahifalar ochiq, shaxsiy bo'limlar yopiq */
export default function robots(): MetadataRoute.Robots {
  const base = getServerEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/jobs", "/students", "/help", "/company/", "/privacy", "/account-deletion"],
      disallow: ["/admin", "/api/", "/auth", "/onboarding", "/employer", "/workers", "/company/settings", "/company/join", "/profile", "/settings", "/messages", "/applications", "/offers", "/saved", "/notifications", "/billing"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
