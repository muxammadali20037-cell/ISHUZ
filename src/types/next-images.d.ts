// Rasm importlari (`import x from "@/assets/....jpg"`) uchun tiplar.
// Odatda ular `next-env.d.ts` dan keladi, lekin u fayl gitda yo'q va faqat
// `next dev` / `next build` paytida yaratiladi. CI'da `tsc` build'dan oldin
// ishlaydi, shuning uchun tiplarni shu yerda aniq ulaymiz.
/// <reference types="next/image-types/global" />
