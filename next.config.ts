import type { NextConfig } from "next";
import { adminSecurityHeaders, baseSecurityHeaders } from "./src/lib/security/headers";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PDF CV shriftlari serverless funksiyaga qo'shiladi (fs orqali o'qiladi)
  outputFileTracingIncludes: {
    "/api/telegram/webhook": ["./src/features/cv/fonts/*"],
    "/api/cv/pdf": ["./src/features/cv/fonts/*"],
  },
  images: {
    // faqat o'z Supabase loyihamiz va Telegram avatarlari (boshqa *.supabase.co loyihalari orqali proksi yo'q)
    remotePatterns: [
      { protocol: "https", hostname: "t.me" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
  },
  async headers() {
    const csp = { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev: process.env.NODE_ENV !== "production" };
    const adminHost = process.env.ADMIN_HOST?.trim();
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // CSP, HSTS, nosniff va h.k. (src/lib/security/headers.ts). Keyingi qoidalar bir xil kalitni ustidan yozadi.
      { source: "/(.*)", headers: baseSecurityHeaders(csp) },
      // admin panel ramkaga olinmaydi va keshlanmaydi (alohida hostda ham, /admin yo'lida ham)
      { source: "/admin/:path*", headers: adminSecurityHeaders(csp) },
      { source: "/admin", headers: adminSecurityHeaders(csp) },
      ...(adminHost ? [{ source: "/(.*)", has: [{ type: "host" as const, value: adminHost }], headers: adminSecurityHeaders(csp) }] : []),
    ];
  },
};

export default nextConfig;
