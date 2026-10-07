import "server-only";

import { cookies } from "next/headers";
import { ANDROID_APP, APP_COOKIE } from "./app-platform";

/** Server komponentlar uchun: so'rov Android ilova ichidanmi */
export async function isAndroidApp(): Promise<boolean> {
  return (await cookies()).get(APP_COOKIE)?.value === ANDROID_APP;
}
