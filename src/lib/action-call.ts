import type { ActionResult } from "@/features/auth/actions";

/**
 * Server action'ni brauzerdan xavfsiz chaqirish (C7): tarmoq uzilsa yoki server javob bermasa, amal tashlagan istisno
 * butun sahifani xato ekraniga aylantirmaydi va tugma "kutilmoqda"da qolib ketmaydi — oddiy natija qaytadi:
 *  · "offline" — brauzer internet yo'qligini biladi;
 *  · "network" — so'rov yetib bormadi yoki javob uzildi;
 *  · "timeout" — javob `timeoutMs` ichida kelmadi. Bu "server saqlamadi" degani EMAS: chaqiruvchi amal idempotent
 *    bo'lishi (clientRef / upsert) va foydalanuvchiga "saqlangan bo'lishi mumkin — qayta bosing" deyilishi kerak.
 */
export async function callAction<T>(run: () => Promise<ActionResult<T>>, timeoutMs = 30_000): Promise<ActionResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<ActionResult<T>>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: "timeout" }), timeoutMs);
      }),
    ]);
  } catch {
    return { ok: false, error: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
