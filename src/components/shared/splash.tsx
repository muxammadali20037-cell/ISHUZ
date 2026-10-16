import { BRAND } from "@/config/brand";
import { getT } from "@/lib/i18n/server";

/**
 * Ochilish ekrani: "Ish topdim" yozuvi, keyin kamera "topdim" so'ziga yaqinlashib, uning ichidan ilovaga kiradi (~1.2 s).
 * - faqat ilova ochilganda, sessiyada bir marta (SPLASH_BOOT `<head>` da — qayta yuklashda miltillamaydi);
 * - kontent ostida darhol chiziladi, splash bosishni to'smaydi (pointer-events: none), sun'iy kutish yo'q;
 * - harakat kamaytirilgan qurilmada, admin panelda va avtomatlashtirilgan brauzerda (navigator.webdriver) ko'rsatilmaydi.
 * Matn `data-t` + CSS `content` orqali: ekran o'qigichi va sahifa matni qidiruvi uchun bu bezak (aria-hidden).
 */
export async function Splash() {
  const { t } = await getT();
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-logo">
        <span className="splash-mark">
          <svg viewBox="0 0 512 512" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M196 168 V140 A28 28 0 0 1 224 112 H288 A28 28 0 0 1 316 140 V168" strokeWidth="40" />
            <rect x="100" y="168" width="312" height="232" rx="48" strokeWidth="40" />
            <path d="M190 284 L240 332 L326 240" strokeWidth="44" />
          </svg>
        </span>
        <span className="splash-word">
          <span className="splash-ish" data-t={BRAND.wordmark[0]} />
          <span className="splash-top" data-t={BRAND.wordmark[1]} />
        </span>
        <span className="splash-slogan" data-t={t("welcome.splash.slogan")} />
      </div>
      <span className="splash-bar" />
    </div>
  );
}

/** `<head>` da, gidratsiyadan oldin: splash allaqachon ko'rsatilgan / kerak emas bo'lsa — darhol yashiriladi */
export const SPLASH_BOOT = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem('ib_splash')||navigator.webdriver||location.pathname.indexOf('/admin')===0||location.hostname.indexOf('admin.')===0||matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('no-splash')}else{sessionStorage.setItem('ib_splash','1')}}catch(e){d.classList.add('no-splash')}})();`;
