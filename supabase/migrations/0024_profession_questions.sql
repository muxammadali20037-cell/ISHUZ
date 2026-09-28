-- ISH.UZ · 0024 · kasbga qarab savollar ("Guvohnomangiz qaysi toifada?", "Qaysi dasturlarda ishlaysiz?").
-- Javoblar oddiy ko'nikma (worker_skills) sifatida saqlanadi — moslik va qidiruv o'zgarmasdan ishlaydi.
-- Savollar ma'lumotnoma: admin (categories.manage) kod o'zgartirmasdan qo'shadi/tahrirlaydi.

create table if not exists public.skill_questions (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.categories(id) on delete cascade,
  -- bo'sh bo'lsa — butun soha uchun; aks holda faqat shu kasblar uchun (subcategories.slug)
  subcategory_slugs text[] not null default '{}',
  slug             text not null unique,
  title_uz         text not null,
  title_ru         text not null,
  hint_uz          text,
  hint_ru          text,
  sort_order       int not null default 100,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.skill_question_options (
  question_id  uuid not null references public.skill_questions(id) on delete cascade,
  skill_id     uuid not null references public.skills(id) on delete cascade,
  sort_order   int not null default 100,
  primary key (question_id, skill_id)
);

alter table public.skill_questions enable row level security;
alter table public.skill_question_options enable row level security;
drop policy if exists "skill_questions_read" on public.skill_questions;
drop policy if exists "skill_questions_admin" on public.skill_questions;
drop policy if exists "skill_question_options_read" on public.skill_question_options;
drop policy if exists "skill_question_options_admin" on public.skill_question_options;
create policy "skill_questions_read" on public.skill_questions for select using (true);
create policy "skill_questions_admin" on public.skill_questions for all using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
create policy "skill_question_options_read" on public.skill_question_options for select using (true);
create policy "skill_question_options_admin" on public.skill_question_options for all using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
grant select on public.skill_questions, public.skill_question_options to anon, authenticated;
grant insert, update, delete on public.skill_questions, public.skill_question_options to authenticated;

-- Yetishmayotgan ko'nikmalar (savollar uchun)
insert into public.skills (slug, name_uz, name_ru, category_id)
select s.slug, s.name_uz, s.name_ru, c.id from (values
  ('driver_license_be', 'BE toifa guvohnoma', 'Права категории BE', 'driver'),
  ('driver_license_ce', 'CE toifa guvohnoma', 'Права категории CE', 'driver'),
  ('driver_automatic', 'Avtomat uzatmalar qutisi', 'Автомат', 'driver'),
  ('finance_excel', 'Excel', 'Excel', 'finance'),
  ('finance_mysoliq', 'my.soliq.uz kabineti', 'Кабинет my.soliq.uz', 'finance'),
  ('finance_1c_zup', '1C ZUP (ish haqi)', '1С ЗУП', 'finance'),
  ('finance_bank_client', 'Bank-klient', 'Банк-клиент', 'finance'),
  ('restaurant_national', 'Milliy taomlar', 'Национальная кухня', 'restaurant'),
  ('restaurant_fastfood', 'Fast-fud', 'Фастфуд', 'restaurant'),
  ('restaurant_grill', 'Mangal / grill', 'Мангал / гриль', 'restaurant'),
  ('restaurant_pastry', 'Qandolat mahsulotlari', 'Кондитерские изделия', 'restaurant'),
  ('construction_welding', 'Payvandlash (svarka)', 'Сварка', 'construction'),
  ('construction_masonry', 'G''isht terish', 'Кладка кирпича', 'construction'),
  ('construction_drywall', 'Gipsokarton', 'Гипсокартон', 'construction'),
  ('construction_painting', 'Bo''yash', 'Покраска', 'construction'),
  ('courier_foot', 'Piyoda', 'Пешком', 'courier'),
  ('courier_moto', 'Mototsikl / moped', 'Мотоцикл / мопед', 'courier')
) as s(slug, name_uz, name_ru, cat)
join public.categories c on c.slug = s.cat
on conflict (slug) do nothing;

-- Savollar
insert into public.skill_questions (category_id, subcategory_slugs, slug, title_uz, title_ru, hint_uz, hint_ru, sort_order)
select c.id, q.subs, q.slug, q.tuz, q.tru, q.huz, q.hru, q.so from (values
  ('driver', '{}'::text[], 'driver_license', 'Haydovchilik guvohnomangiz qaysi toifada?', 'Какая категория прав?', 'Bir nechtasini tanlash mumkin', 'Можно выбрать несколько', 10),
  ('driver', '{}'::text[], 'driver_extra', 'Yana nimalar to''g''ri keladi?', 'Что ещё подходит?', null, null, 20),
  ('courier', '{}'::text[], 'courier_transport', 'Qanday yetkazasiz?', 'На чём доставляете?', null, null, 10),
  ('finance', '{}'::text[], 'finance_software', 'Qaysi dasturlarda ishlaysiz?', 'В каких программах работаете?', 'Ish beruvchilar ko''pincha shularni so''raydi', 'Работодатели часто спрашивают именно это', 10),
  ('it', '{}'::text[], 'it_stack', 'Qaysi texnologiyalarni bilasiz?', 'Какие технологии знаете?', 'Ishonch bilan ishlatadiganlaringizni tanlang', 'Выберите те, которыми уверенно владеете', 10),
  ('restaurant', '{cook,cook_assistant,chef,kitchen_worker,cook_home,sushi,pizza,shashlik,samsa,baker,confectioner}'::text[], 'restaurant_cuisine', 'Qaysi taomlarni tayyorlaysiz?', 'Какую кухню готовите?', null, null, 10),
  ('restaurant', '{barista,bartender,waiter,runner,hostess,cashier,admin,restaurant_manager}'::text[], 'restaurant_service', 'Nimalarni bilasiz?', 'Что умеете?', null, null, 20),
  ('sales', '{}'::text[], 'sales_tools', 'Qaysi kassa va dasturlarda ishlagansiz?', 'С какими кассами и программами работали?', null, null, 10),
  ('construction', '{}'::text[], 'construction_work', 'Qanday ishlarni bajarasiz?', 'Какие работы выполняете?', null, null, 10),
  ('office', '{}'::text[], 'office_tools', 'Qaysi dasturlarni bilasiz?', 'Какие программы знаете?', null, null, 10)
) as q(cat, subs, slug, tuz, tru, huz, hru, so)
join public.categories c on c.slug = q.cat
on conflict (slug) do nothing;

insert into public.skill_question_options (question_id, skill_id, sort_order)
select q.id, s.id, o.so from (values
  ('driver_license', 'driver_license_b', 10), ('driver_license', 'driver_license_be', 15), ('driver_license', 'driver_license_c', 20), ('driver_license', 'driver_license_ce', 25),
  ('driver_license', 'driver_license_d', 30), ('driver_license', 'driver_license_e', 40),
  ('driver_extra', 'driver_own_car', 10), ('driver_extra', 'driver_manual', 20), ('driver_extra', 'driver_automatic', 25), ('driver_extra', 'driver_intercity', 30), ('driver_extra', 'driver_yandex_go', 40),
  ('courier_transport', 'courier_foot', 5), ('courier_transport', 'courier_bicycle', 10), ('courier_transport', 'courier_scooter', 20), ('courier_transport', 'courier_moto', 25), ('courier_transport', 'courier_own_car_c', 30), ('courier_transport', 'courier_city_knowledge', 40),
  ('finance_software', 'finance_1c_acc', 10), ('finance_software', 'finance_1c_zup', 15), ('finance_software', 'finance_excel', 20), ('finance_software', 'finance_didox', 30),
  ('finance_software', 'finance_mysoliq', 40), ('finance_software', 'finance_bank_client', 50), ('finance_software', 'finance_tax', 60), ('finance_software', 'finance_payroll', 70),
  ('it_stack', 'it_javascript', 10), ('it_stack', 'it_typescript', 11), ('it_stack', 'it_react', 12), ('it_stack', 'it_nextjs', 13), ('it_stack', 'it_nodejs', 14),
  ('it_stack', 'it_python', 20), ('it_stack', 'it_java', 21), ('it_stack', 'it_csharp', 22), ('it_stack', 'it_golang', 23), ('it_stack', 'it_php', 24), ('it_stack', 'it_laravel', 25),
  ('it_stack', 'it_flutter', 30), ('it_stack', 'it_kotlin', 31), ('it_stack', 'it_swift', 32),
  ('it_stack', 'it_sql', 40), ('it_stack', 'it_postgresql', 41), ('it_stack', 'it_docker', 42), ('it_stack', 'it_git', 43), ('it_stack', 'it_linux', 44), ('it_stack', 'it_figma', 45),
  ('restaurant_cuisine', 'restaurant_national', 10), ('restaurant_cuisine', 'restaurant_european', 20), ('restaurant_cuisine', 'restaurant_asian', 30), ('restaurant_cuisine', 'restaurant_fastfood', 40),
  ('restaurant_cuisine', 'restaurant_grill', 50), ('restaurant_cuisine', 'restaurant_baking', 60), ('restaurant_cuisine', 'restaurant_pastry', 70), ('restaurant_cuisine', 'restaurant_haccp', 80),
  ('restaurant_service', 'restaurant_coffee', 10), ('restaurant_service', 'restaurant_latte_art', 20), ('restaurant_service', 'restaurant_cocktails', 30), ('restaurant_service', 'restaurant_r_keeper', 40),
  ('sales_tools', 'sales_pos', 10), ('sales_tools', 'sales_cash', 20), ('sales_tools', 'sales_click', 30), ('sales_tools', 'sales_payme', 40), ('sales_tools', 'sales_1c', 50), ('sales_tools', 'sales_excel', 60), ('sales_tools', 'sales_crm', 70),
  ('construction_work', 'construction_masonry', 10), ('construction_work', 'construction_plastering', 20), ('construction_work', 'construction_tiling', 30), ('construction_work', 'construction_concrete_w', 40),
  ('construction_work', 'construction_welding', 50), ('construction_work', 'construction_drywall', 60), ('construction_work', 'construction_painting', 70), ('construction_work', 'construction_laminate', 80),
  ('construction_work', 'construction_facade', 90), ('construction_work', 'construction_scaffolding', 100),
  ('office_tools', 'office_ms_office', 10), ('office_tools', 'office_google_docs', 20), ('office_tools', 'office_document_flow', 30), ('office_tools', 'office_presentations', 40)
) as o(q, skill, so)
join public.skill_questions q on q.slug = o.q
join public.skills s on s.slug = o.skill
on conflict do nothing;
