import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session";
import { MODE_COOKIE, resolveMode, type AppMode } from "./mode";

/** Joriy rejim (bitta so'rov davomida keshlanadi) */
export const getMode = cache(async (): Promise<AppMode | null> => {
  const [session, jar] = await Promise.all([getSession(), cookies()]);
  return resolveMode({ activeRole: session?.profile.active_role ?? null, cookie: jar.get(MODE_COOKIE)?.value ?? null, roles: session?.roles ?? [] });
});
