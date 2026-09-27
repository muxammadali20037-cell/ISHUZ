import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

/**
 * Digital Asset Links: Google Play'dagi Android ilova (Trusted Web Activity) shu sayt bilan bog'lanadi
 * va brauzer paneli ko'rinmaydi. Barmoq izlari Play Console → App integrity → App signing dan olinadi.
 */
export function GET() {
  const { ANDROID_PACKAGE_NAME, ANDROID_SHA256_CERT_FINGERPRINTS } = getServerEnv();
  const fingerprints = (ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  const body = fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: ANDROID_PACKAGE_NAME, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return NextResponse.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
