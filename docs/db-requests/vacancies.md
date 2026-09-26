# VACANCIES moduli — DB/RPC so'rovlari va kuzatuvlar

Modul hozirgi sxema bilan to'liq ishlaydi; quyidagilar yaxshilash takliflari (majburiy emas).

## 1. `insert into vacancies ... returning` RLS'da yiqiladi (workaround qo'llandi)
`vacancies_read_own` policy `manages_vacancy(id)` ni chaqiradi — bu `security definer` + `stable` funksiya
o'z SELECT'ini bayonot snapshot'ida bajaradi, yangi qo'shilgan qator unga ko'rinmaydi. Natijada
`INSERT ... RETURNING` (supabase-js `.insert().select()`) `new row violates row-level security policy` beradi
(lokal Postgres'da tekshirildi). Workaround: `createDraft`/`duplicateVacancy` UUID'ni serverda (`randomUUID()`) yaratib,
`select`'siz insert qiladi.
Taklif: `vacancies_read_own` ga `owner_profile_id = auth.uid()` shartini funksiyadan oldin qo'shish:
`using (owner_profile_id = auth.uid() or public.manages_vacancy(id) or ...)`.

## 2. `expired` holatdagi vakansiyani to'g'ridan-to'g'ri tahrirlab bo'lmaydi
`vacancies_update` WITH CHECK ro'yxatida `expired` yo'q → UI avval `set_vacancy_status(id, 'draft')` chaqiradi, keyin saqlaydi
(foydalanuvchiga "qoralamaga o'tkazildi" deb aytiladi). Agar `expired` ham tahrirlanishi kerak bo'lsa — ro'yxatga qo'shing.

## 3. `set_vacancy_status` `rejected` holatdan hech narsa qilmaydi
`where ... status in ('active','paused','pending_review','draft','expired')` — `rejected` yo'q. Hozir kerak emas
(rejected to'g'ridan-to'g'ri tahrirlanadi va `publish_vacancy` → `pending_review`), lekin "rad etilganni yopish/o'chirish" kerak bo'lsa e'tiborga oling.

## 4. Nusxa olish — atomar RPC taklifi
`duplicateVacancy` action 4 ta so'rov bilan (vacancies + skills + languages + benefits) ishlaydi; oraliqda xato bo'lsa
qoralama qisman nusxalanadi (foydalanuvchi tahrirlab to'ldiradi). `duplicate_vacancy(p_vacancy_id) returns uuid` RPC (security definer, can_edit tekshiruvi bilan)
buni atomar qiladi.

## 5. Ko'nikma qidiruvi
Client'da `skills` jadvalidan `ilike` bilan qidiriladi (RLS: faqat approved yoki o'zi qo'shgan). Trigram indeks bor —
`search_skills(p_query text, p_category_id uuid, p_limit int)` RPC (similarity bo'yicha saralash) natijani yaxshilaydi.

## 6. Ro'yxat hisoblagichlari
`/employer/vacancies` bitta so'rovda (limit 500) barcha mening vakansiyalarimni olib, tab hisoblagichlarini TS'da hisoblaydi.
500+ vakansiyali kompaniyalar uchun `my_vacancy_counts()` RPC + sahifalash kerak bo'ladi.

## 7. Paketlar
Yangi paket kerak bo'lmadi.
