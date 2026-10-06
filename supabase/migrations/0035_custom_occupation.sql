-- ISH BERUVCHI · 0035 · "Topilmadimi? O'zingiz yozing" (spec §14).
-- Katalogda yo'q kasb qo'lda yoziladi: asl matn yo'qolmaydi, e'lon/profil ishlayveradi (matnli qidiruvda topiladi),
-- so'rov katalogni keyinchalik tekshirib boyitish navbatiga tushadi. Bitta foydalanuvchi matni avtomatik global kasb bo'lmaydi.

alter table public.worker_profiles add column if not exists custom_profession text check (custom_profession is null or length(btrim(custom_profession)) between 2 and 120);
alter table public.vacancies add column if not exists custom_profession text check (custom_profession is null or length(btrim(custom_profession)) between 2 and 120);

create table if not exists public.custom_occupation_requests (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  raw_text        text not null check (length(btrim(raw_text)) between 2 and 120),
  normalized      text generated always as (public.normalize_search_text(raw_text)) stored,
  category_id     uuid references public.categories(id) on delete set null,
  context         text not null check (context in ('worker', 'vacancy')),
  worker_id       uuid references public.worker_profiles(id) on delete cascade,
  vacancy_id      uuid references public.vacancies(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'linked', 'added', 'rejected')),
  linked_node_id  uuid references public.profession_nodes(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_custom_occ_pending on public.custom_occupation_requests(normalized) where status = 'pending';
create unique index if not exists uq_custom_occ_worker on public.custom_occupation_requests(worker_id, normalized) where worker_id is not null;
create unique index if not exists uq_custom_occ_vacancy on public.custom_occupation_requests(vacancy_id, normalized) where vacancy_id is not null;

alter table public.custom_occupation_requests enable row level security;
drop policy if exists "custom_occ_own_read" on public.custom_occupation_requests;
drop policy if exists "custom_occ_own_insert" on public.custom_occupation_requests;
drop policy if exists "custom_occ_admin" on public.custom_occupation_requests;
create policy "custom_occ_own_read" on public.custom_occupation_requests for select using (created_by = auth.uid());
create policy "custom_occ_own_insert" on public.custom_occupation_requests for insert with check (
  created_by = auth.uid()
  and (worker_id is null or exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()))
  and (vacancy_id is null or public.can_edit_vacancy(vacancy_id))
);
create policy "custom_occ_admin" on public.custom_occupation_requests for all
  using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
grant select, insert on public.custom_occupation_requests to authenticated;

-- Tugun tanlansa qo'lda yozilgan kasb tozalanadi (ikkalasi bir vaqtda bo'lmaydi)
create or replace function public.clear_custom_profession_on_node()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.profession_node_id is not null and (tg_op = 'INSERT' or new.profession_node_id is distinct from old.profession_node_id) then
    new.custom_profession := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_worker_profiles_custom on public.worker_profiles;
create trigger trg_worker_profiles_custom before insert or update of profession_node_id on public.worker_profiles
  for each row execute function public.clear_custom_profession_on_node();
drop trigger if exists trg_vacancies_custom on public.vacancies;
create trigger trg_vacancies_custom before insert or update of profession_node_id on public.vacancies
  for each row execute function public.clear_custom_profession_on_node();
