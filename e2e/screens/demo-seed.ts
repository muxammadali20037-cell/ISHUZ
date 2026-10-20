import { sql } from "../support";

/**
 * Skrinshotlar uchun namunaviy ma'lumot (faqat lokal stendda): bitta tasdiqlangan kompaniya, 8 ta e'lon, bitta ishchi.
 * Aniq id'lar bilan qayta yoziladi — "oldin" va "keyin" bir xil holatda olinadi. Tozalash: cleanDemo().
 */
export const DEMO = {
  employer: "7e2e0000-0000-4000-8000-000000000090",
  worker: "7e2e0000-0000-4000-8000-000000000091",
  company: "7e2e0000-0000-4000-8000-0000000000c1",
} as const;

export async function cleanDemo() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [DEMO.employer]);
}

/** Namunaviy ma'lumotni yozadi; "Sotuv menejeri" e'lonining slug'ini qaytaradi */
export async function seedDemo(): Promise<string> {
  const { employer: EMP, worker: WRK, company: COMPANY } = DEMO;
  await cleanDemo();
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
       ($1, '+998901110090', now(), '{"first_name":"Dilnoza","last_name":"Rahimova"}'),
       ($2, '+998901110091', now(), '{"first_name":"Aziz","last_name":"Karimov"}')
     on conflict (id) do nothing`,
    [EMP, WRK],
  );
  await sql(
    `insert into public.companies (id, name, slug, verification_status, verified_at, region_id, created_by)
     select $1, 'Orient Savdo', 'orient-savdo-demo', 'verified', now(), r.id, $2 from public.regions r where r.slug = 'tashkent_city'
     on conflict (id) do update set name = excluded.name, verification_status = 'verified'`,
    [COMPANY, EMP],
  );
  await sql(`insert into public.company_members (company_id, profile_id, role) values ($1, $2, 'owner') on conflict do nothing`, [COMPANY, EMP]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at, company_id)
     values ($1, 'company', 'Orient Savdo', now(), $2)
     on conflict (profile_id) do update set onboarding_completed_at = now(), company_id = excluded.company_id`,
    [EMP, COMPANY],
  ).catch(async () => {
    // company_id ustuni bo'lmasa — eskicha
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'company', 'Orient Savdo', now())
       on conflict (profile_id) do update set onboarding_completed_at = now()`,
      [EMP],
    );
  });
  await sql("update public.profiles set active_role = 'employer' where id = $1", [EMP]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, category_id, region_id, district_id, experience_level, onboarding_completed_at, is_public)
     select $1, 'Sotuvchi', c.id, r.id, d.id, '1_2y', now(), true
     from public.categories c, public.regions r join public.districts d on d.region_id = r.id
     where c.slug = 'sales' and r.slug = 'tashkent_city' and d.name_uz = 'Chilonzor tumani'`,
    [WRK],
  );
  await sql("update public.profiles set active_role = 'worker' where id = $1", [WRK]);
  const desc =
    "Nima qilasiz:\n— mijozlar bilan ishlash va savdo rejasini bajarish;\n— buyurtmalarni rasmiylashtirish.\n\nTalablar:\n— muloqotga ochiqlik;\n— kamida 1 yil savdo tajribasi.\n\nSharoitlar:\n— rasmiy ishga joylashish;\n— tushlik bepul;\n— oyiga ikki marta oylik.";
  const rows: [string, string, string, number | null, number | null, string, boolean, string, string, number, string, boolean, number, string | null][] = [
    // title, category, district, from, to, salary_type, negotiable, schedule, employment, exp months, age, remote, positions, profession (name_uz)
    ["Sotuv menejeri", "sales", "Chilonzor tumani", 5_000_000, 8_000_000, "monthly", false, "5_2", "full_time", 12, "40 minutes", false, 1, "Sotuvchi"],
    ["Kassir", "sales", "Yunusobod tumani", 4_500_000, null, "monthly", false, "shift", "full_time", 0, "2 hours", false, 2, "Kassir"],
    ["Yuk tashuvchi (bir kunlik ish)", "logistics", "Sirg'ali tumani", 250_000, 300_000, "daily", false, "flexible", "temporary", 0, "5 hours", false, 6, null],
    ["Ofitsiant", "restaurant", "Mirobod tumani", null, null, "negotiable", true, "6_1", "full_time", 0, "1 day", false, 1, "Ofitsiant"],
    ["Bosh buxgalter (1C, soliq hisobotlari va moliyaviy tahlil bo'yicha tajribali mutaxassis)", "finance", "Yakkasaroy tumani", 12_000_000, 15_000_000, "monthly", false, "5_2", "full_time", 36, "1 day 3 hours", false, 1, "Buxgalter"],
    ["Frontend dasturchi (React)", "it", "Mirzo Ulug'bek tumani", 15_000_000, 20_000_000, "monthly", false, "flexible", "remote", 24, "2 days", true, 1, null],
    ["Haydovchi-ekspeditor", "driver", "Yangihayot tumani", 6_000_000, null, "monthly", false, "6_1", "full_time", 12, "3 days", false, 2, null],
    ["Call-markaz operatori (talabalar uchun)", "call_center", "Shayxontohur tumani", 3_500_000, null, "monthly", false, "shift", "part_time", 0, "4 days", false, 5, null],
  ];
  for (const [title, cat, district, from, to, stype, neg, schedule, employment, exp, age, remote, positions, profession] of rows) {
    await sql(
      `insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, district_id, description, status,
         salary_from, salary_to, salary_type, salary_negotiable, schedule, employment_type, experience_min_months, is_remote,
         positions_count, student_friendly, published_at, expires_at, profession_node_id)
       select $1, $2, $3, c.id, r.id, d.id, $4, 'active', $5, $6, $7::public.salary_type, $8, $9::public.work_schedule, $10::public.employment_type, $11, $12,
              $13, $3 like '%talabalar%', now() - $14::interval, now() + interval '7 days',
              (select n.id from public.profession_nodes n where n.name_uz = $17 and n.selectable limit 1)
       from public.categories c, public.regions r left join public.districts d on d.region_id = r.id and d.name_uz = $15
       where c.slug = $16 and r.slug = 'tashkent_city'`,
      [EMP, COMPANY, title, desc, from, to, stype, neg, schedule, employment, exp, remote, positions, age, district, cat, profession],
    );
  }
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where owner_profile_id = $1 and title = 'Sotuv menejeri'", [EMP]);
  return v!.slug;
}
