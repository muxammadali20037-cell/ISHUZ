import "server-only";

/*
 * Mahsulot bayroqlari (feature flags). Joriy reliz: admin panel ilova ichida YO'Q (keyin alohida loyiha),
 * to'lov/paywall YO'Q. Kod saqlanadi — bayroq yoqilsa qaytadi. To'lovni yoqish uchun ham BILLING_ENABLED=true,
 * ham bazada app_settings.billing_enabled=true bo'lishi kerak (e'lon qilish qoidasi bazada).
 */
export function adminUiEnabled(): boolean {
  return process.env.ADMIN_UI_ENABLED === "true";
}

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}
