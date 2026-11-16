import { redirect } from "next/navigation";

/**
 * 06 "Qayerda ishlashni istaysiz?" — olib tashlandi (ega, 2026-11-17: "kerak emas"). Hudud bosh sahifadagi joy tugmasidan
 * tanlanadi. Eski havolalar bosh sahifaga olib boradi.
 */
export default function PlaceStepRemoved() {
  redirect("/");
}
