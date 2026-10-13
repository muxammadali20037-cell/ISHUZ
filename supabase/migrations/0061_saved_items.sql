-- 0061 · "Saqlanganlar" hamma uchun (E2): ish izlovchi vakansiyani, ish beruvchi ishchini saqlaydi — profil to'ldirish
--        shart emas (eski saved_vacancies ishchi profilini, saved_workers ish beruvchi profilini talab qiladi).
--
--  1) saved_items — bitta jadval: kim (profile_id) nimani (vacancy_id yoki worker_id) saqlagan. RLS: faqat o'zinikini
--     o'qiydi/qo'shadi/o'chiradi; bloklangan yoki sessiyasi bekor qilingan foydalanuvchi yoza olmaydi (sec_active_*).
--     Bir kishiga 500 tagacha (saved_limit).
--  2) my_saved_vacancies() / my_saved_workers() — "Saqlanganlar" sahifasi uchun: qidiruv kartalari bilan bir xil ustunlar
--     (telefon ham o'sha qoida bilan), faqat hozir ko'rinadigan e'lonlar; eski saved_vacancies / saved_workers ham qo'shiladi.
--  3) simple_listing_features(): saved_items = true.
--
-- Faqat qo'shimcha: DROP/DELETE yo'q; eski jadvallar o'zgarmaydi (papka/eslatmali saqlash — ish beruvchi paneli).
-- Rollback: my_saved_* funksiyalari va saved_items jadvalini olib tashlash; simple_listing_features() ni 0060 holatiga.

-- ---------------------------------------------------------------------------------------------------
-- 1. Jadval
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.saved_items (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  vacancy_id  uuid references public.vacancies(id) on delete cascade,
  worker_id   uuid references public.worker_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint saved_items_one_target check (num_nonnulls(vacancy_id, worker_id) = 1)
);
create unique index if not exists saved_items_vacancy_uq on public.saved_items (profile_id, vacancy_id) where vacancy_id is not null;
create unique index if not exists saved_items_worker_uq on public.saved_items (profile_id, worker_id) where worker_id is not null;
create index if not exists saved_items_profile_idx on public.saved_items (profile_id, created_at desc);
-- o'chirilgan e'lon/profil bilan birga (cascade) tez tozalanishi uchun
create index if not exists saved_items_vacancy_idx on public.saved_items (vacancy_id) where vacancy_id is not null;
create index if not exists saved_items_worker_idx on public.saved_items (worker_id) where worker_id is not null;

alter table public.saved_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'saved_items_own_select') then
    create policy "saved_items_own_select" on public.saved_items for select to authenticated using (profile_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'saved_items_own_insert') then
    create policy "saved_items_own_insert" on public.saved_items for insert to authenticated with check (profile_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'saved_items_own_delete') then
    create policy "saved_items_own_delete" on public.saved_items for delete to authenticated using (profile_id = (select auth.uid()));
  end if;
  -- 0056 dagi qoida: bloklangan / sessiyasi bekor qilingan foydalanuvchi yozmaydi
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'sec_active_insert') then
    create policy sec_active_insert on public.saved_items as restrictive for insert to authenticated with check ((select public.is_active_user()));
    create policy sec_active_update on public.saved_items as restrictive for update to authenticated using (true) with check ((select public.is_active_user()));
    create policy sec_active_delete on public.saved_items as restrictive for delete to authenticated using ((select public.is_active_user()));
  end if;
end $$;
revoke all on public.saved_items from anon, authenticated;
grant select, insert, delete on public.saved_items to authenticated;

create or replace function public.trg_saved_items_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_items where profile_id = new.profile_id) >= 500 then
    raise exception 'saved_limit' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.trg_saved_items_limit() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_saved_items_limit' and tgrelid = 'public.saved_items'::regclass) then
    create trigger trg_saved_items_limit before insert on public.saved_items for each row execute function public.trg_saved_items_limit();
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. "Saqlanganlar" ro'yxatlari (qidiruv kartalari bilan bir xil ustunlar; faqat o'zinikini)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.my_saved_vacancies(p_limit int default 100)
returns table (
  id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  region_wide boolean, is_remote boolean,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, work_time_from time, work_time_to time, experience_min_months int,
  summary text, phone text, published_at timestamptz, is_featured boolean, saved_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select s.vacancy_id as vid, s.created_at as at from public.saved_items s where s.profile_id = auth.uid() and s.vacancy_id is not null
    union all
    select sv.vacancy_id, sv.created_at from public.saved_vacancies sv where sv.worker_id = public.current_worker_id()
  ),
  latest as (select vid, max(at) as at from mine group by vid)
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    false, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, ep.contact_phone)
    end,
    c.published_at, (c.is_featured and (c.featured_until is null or c.featured_until > now())), l.at
  from latest l
  join public.vacancies c on c.id = l.vid and c.status = 'active'
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  where auth.uid() is not null
  order by l.at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.my_saved_workers(p_limit int default 100)
returns table (
  id uuid, first_name text, last_initial text, avatar_url text, headline text,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text, about text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  region_wide boolean, remote_ok boolean, experience_level public.experience_level, salary_expected int,
  phone text, last_active_at timestamptz, saved_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select s.worker_id as wid, s.created_at as at from public.saved_items s where s.profile_id = auth.uid() and s.worker_id is not null
    union all
    select sw.worker_id, sw.created_at from public.saved_workers sw where sw.employer_profile_id = auth.uid()
  ),
  latest as (select wid, max(at) as at from mine group by wid)
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    left(regexp_replace(coalesce(w.about, ''), '\s+', ' ', 'g'), 220),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    false, w.remote_preference = 'yes', w.experience_level, pr.salary_expected,
    case when pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id) then pc.phone end,
    w.last_active_at, l.at
  from latest l
  join public.worker_profiles w on w.id = l.wid
    and w.is_public and w.onboarding_completed_at is not null and w.status <> 'not_looking'
  join public.profiles pf on pf.id = w.profile_id and not pf.is_blocked
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where auth.uid() is not null
  order by l.at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.my_saved_vacancies(int), public.my_saved_workers(int) from public, anon;
grant execute on function public.my_saved_vacancies(int), public.my_saved_workers(int) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Imkoniyat bayrog'i
-- ---------------------------------------------------------------------------------------------------
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true, 'media_quarantine', true, 'daily_jobs', true, 'saved_items', true);
$$;
