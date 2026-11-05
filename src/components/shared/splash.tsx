import { BrandLogo } from "./brand-logo";
import { getT } from "@/lib/i18n/server";

/**
 * Ochilish ekrani: "Ish topdim" logotipi ("Darvoza" belgisi va yozuv) va shior, keyin yumshoq yo'qoladi (~1.4 s).
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
          <BrandLogo layout="stacked" />
        </span>
        <span className="splash-slogan" data-t={t("welcome.splash.slogan")} />
      </div>
      <span className="splash-bar" />
    </div>
  );
}

/** `<head>` da, gidratsiyadan oldin: splash allaqachon ko'rsatilgan / kerak emas bo'lsa — darhol yashiriladi */
export const SPLASH_BOOT = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem('ib_splash')||navigator.webdriver||location.pathname.indexOf('/admin')===0||location.hostname.indexOf('admin.')===0||matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('no-splash')}else{sessionStorage.setItem('ib_splash','1')}}catch(e){d.classList.add('no-splash')}})();`;
