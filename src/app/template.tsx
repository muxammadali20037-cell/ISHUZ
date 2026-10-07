import { ViewTransition } from "react";

/**
 * Sahifalar orasida mayin o'tish: har bir navigatsiyada eski sahifa yengil so'nadi, yangisi pastdan ozgina
 * siljib paydo bo'ladi (View Transitions API). template har navigatsiyada qayta yaratiladi, shuning uchun
 * enter/exit ishlaydi; router.refresh() va Suspense ochilishida animatsiya yo'q (default="none").
 * Brauzer qo'llamasa yoki "harakatni kamaytirish" yoqilgan bo'lsa — oddiy almashadi.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
