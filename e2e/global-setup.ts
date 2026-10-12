import { sql } from "./support";

/**
 * Har ishga tushirishdan oldin sinov bazasidagi so'rov chegarasi hisoblagichlari tozalanadi.
 * Cheklovlar (masalan, kuniga N ta vakansiya) haqiqiy va o'zgarmaydi; faqat bir stendda suite qayta-qayta yurganda
 * oldingi yurishlarning hisobi keyingisiga "Juda ko'p urinish" bo'lib o'tmasligi uchun.
 */
export default async function globalSetup() {
  await sql("delete from public.rate_limits");
}
