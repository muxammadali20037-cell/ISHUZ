"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTelegram } from "./provider";
import { decodeStartParam } from "./start-param";

const KEY = "ishuz_tg_start_param";

/**
 * Mini App t.me/<bot>?startapp=<param> havolasi bilan ochilganda (masalan, kanal postidagi «Ariza qoldirish») —
 * kerakli sahifaga o'tadi. Ilova bosh sahifadan ochiladi; bir ochilishda bir marta (orqaga qaytilganda qayta otmaydi).
 * Oddiy brauzerda hech narsa qilmaydi. Yo'l start-param.ts da qat'iy tekshiriladi (faqat ichki).
 */
export function TelegramStartRoute() {
  const { webApp } = useTelegram();
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const param = webApp?.initDataUnsafe?.start_param;
    const path = decodeStartParam(param);
    if (!path) return;
    done.current = true;
    try {
      if (sessionStorage.getItem(KEY) === param) return;
      sessionStorage.setItem(KEY, param!);
    } catch {
      // saqlab bo'lmasa ham bir marta o'tamiz (done.current)
    }
    if (pathname === "/") router.replace(path);
  }, [webApp, pathname, router]);
  return null;
}
