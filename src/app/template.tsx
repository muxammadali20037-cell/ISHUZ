import { ViewTransition } from "react";

/**
 * Sahifalar orasida mayin o'tish (View Transitions API). template har navigatsiyada qayta yaratiladi,
 * shuning uchun enter/exit ishlaydi. Yo'nalish: <Link transitionTypes={["nav-forward"]}> — yangi sahifa o'ngdan
 * kiradi, ["nav-back"] — chapdan; turi yo'q havolalar — yengil so'nish. router.refresh() va Suspense ochilishida
 * animatsiya yo'q (default="none"). Brauzer qo'llamasa yoki "harakatni kamaytirish" yoqilgan bo'lsa — oddiy almashadi.
 */
export const PAGE_ENTER = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-in" };
export const PAGE_EXIT = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-out" };

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={PAGE_ENTER} exit={PAGE_EXIT} default="none">
      {children}
    </ViewTransition>
  );
}
