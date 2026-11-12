/**
 * Xato monitoringi (Sentry, faqat server). `SENTRY_DSN` bo'lmasa hammasi o'chiq va hech narsa yuklanmaydi.
 * Brauzer tomoniga SDK qo'shilmaydi (arzon Android'da sahifa og'irlashmasin) — server xatolari: sahifa render,
 * route handler, server action, proxy, webhook va cron.
 *
 * Maxfiylik: so'rov sarlavhalari, cookie va IP yuborilmaydi (`sendDefaultPii: false`), matndagi O'zbekiston telefon
 * raqamlari va e-mail manzillar yuborishdan oldin yashiriladi.
 */

const PHONE = /\+?998[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function scrubPersonalData(text: string): string {
  return text.replace(PHONE, "+998•••••••••").replace(EMAIL, "•••@•••");
}

export function monitoringEnabled(): boolean {
  return !!process.env.SENTRY_DSN;
}

type SentryEvent = {
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: unknown;
  user?: unknown;
  breadcrumbs?: { message?: string }[];
};

/** Sentry `beforeSend`: shaxsiy ma'lumotni olib tashlaydi */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.message) event.message = scrubPersonalData(event.message);
  for (const v of event.exception?.values ?? []) if (v.value) v.value = scrubPersonalData(v.value);
  for (const b of event.breadcrumbs ?? []) if (b.message) b.message = scrubPersonalData(b.message);
  delete event.request;
  delete event.user;
  return event;
}

export function sentryOptions() {
  return {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: (b: { message?: string }) => {
      if (b.message) b.message = scrubPersonalData(b.message);
      return b;
    },
  };
}

/**
 * O'zi ushlagan (foydalanuvchiga xato ko'rsatmaydigan) joylar uchun: webhook, cron. Logga ham yozadi.
 * Hech qachon xato tashlamaydi.
 */
export async function reportError(error: unknown, context: { where: string; extra?: Record<string, string | number | boolean | null> }): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context.where}]`, scrubPersonalData(message));
  if (!monitoringEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error instanceof Error ? error : new Error(message), { tags: { where: context.where }, extra: context.extra });
    await Sentry.flush(2000);
  } catch {
    // monitoring ishlamasa ham asosiy ish to'xtamaydi
  }
}
