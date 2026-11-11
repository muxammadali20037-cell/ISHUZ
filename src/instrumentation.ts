import type { Instrumentation } from "next";
import { monitoringEnabled, sentryOptions } from "@/lib/monitoring";

/** Server ishga tushganda: SENTRY_DSN bo'lsa — Sentry (faqat server). Bo'lmasa hech narsa yuklanmaydi. */
export async function register() {
  if (!monitoringEnabled()) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(sentryOptions());
  }
}

/** Next.js ushlagan server xatolari (render, route, server action, proxy) → Sentry */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!monitoringEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  // so'rov sarlavhalari (cookie, IP) yuborilmaydi — faqat yo'l va marshrut turi
  Sentry.captureRequestError(error, { path: request.path, method: request.method, headers: {} }, context);
};
