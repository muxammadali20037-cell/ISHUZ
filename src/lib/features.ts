import "server-only";

/*
 * Mahsulot bayroqlari (feature flags). Admin panel alohida hostda (ADMIN_HOST, masalan admin.<domen>) ishlaydi;
 * ommaviy menyuda ko'rinmaydi. Kerak bo'lsa butunlay o'chirish: ADMIN_UI_ENABLED=false.
 * To'lov/paywall: ham BILLING_ENABLED=true, ham bazada app_settings.billing_enabled=true bo'lishi kerak.
 */
export function adminUiEnabled(): boolean {
  return process.env.ADMIN_UI_ENABLED !== "false";
}

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}
