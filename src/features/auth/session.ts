import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface SessionContext {
  userId: string;
  profile: Profile;
  roles: AppRole[];
  workerId: string | null;
  workerOnboarded: boolean;
  employerId: string | null;
  employerOnboarded: boolean;
  companyId: string | null;
  isAdmin: boolean;
  adminRole: Database["public"]["Enums"]["admin_role"] | null;
  activeRole: AppRole | null;
}

/**
 * Joriy sessiya konteksti (bitta so'rov davomida keshlanadi).
 * Login bo'lmasa null.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  // JWT imzosi tekshiriladi (asimmetrik kalitda lokal — har sahifada Auth serveriga so'rov yo'q)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) return null;
  const user = { id: sub };

  const [profileRes, rolesRes, workerRes, employerRes, adminRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("profile_id", user.id),
    supabase.from("worker_profiles").select("id, onboarding_completed_at").eq("profile_id", user.id).maybeSingle(),
    supabase.from("employer_profiles").select("id, onboarding_completed_at, company_id").eq("profile_id", user.id).maybeSingle(),
    supabase.from("admin_users").select("role, is_active").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!profileRes.data) return null;
  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const activeRole = profileRes.data.active_role ?? (roles.includes("worker") ? "worker" : roles.includes("employer") ? "employer" : null);

  return {
    userId: user.id,
    profile: profileRes.data,
    roles,
    workerId: workerRes.data?.id ?? null,
    workerOnboarded: !!workerRes.data?.onboarding_completed_at,
    employerId: employerRes.data?.id ?? null,
    employerOnboarded: !!employerRes.data?.onboarding_completed_at,
    companyId: employerRes.data?.company_id ?? null,
    isAdmin: !!adminRes.data?.is_active,
    adminRole: adminRes.data?.is_active ? adminRes.data.role : null,
    activeRole,
  };
});

/** Login majburiy; bo'lmasa /auth ga yo'naltiradi */
export async function requireSession(next?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(`/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (session.profile.is_blocked) redirect("/blocked");
  return session;
}

/** Ish qidiruvchi profili tugallangan bo'lishi shart */
export async function requireWorker(next?: string): Promise<SessionContext & { workerId: string }> {
  const session = await requireSession(next);
  if (!session.workerId || !session.workerOnboarded) redirect("/onboarding/worker");
  return session as SessionContext & { workerId: string };
}

/** Ish beruvchi profili tugallangan bo'lishi shart */
export async function requireEmployer(next?: string): Promise<SessionContext & { employerId: string }> {
  const session = await requireSession(next);
  if (!session.employerId || !session.employerOnboarded) redirect("/onboarding/employer");
  return session as SessionContext & { employerId: string };
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession("/admin");
  if (!session.isAdmin) redirect("/");
  return session;
}
