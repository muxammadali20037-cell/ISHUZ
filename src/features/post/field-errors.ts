/**
 * Forma xatolari maydon tahrirlanganda o'chadi: foydalanuvchi xatoni tuzatgan bo'lsa ham qizil matn "Davom etish" bosilguncha
 * qolib ketmaydi. Qayta tekshiruv — keyingi "Davom etish"da (yozish paytida yangi xato ko'rsatilmaydi).
 * `fieldOf` — qoralama kaliti → xato kaliti (bir nechta kalit bitta xatoga: maosh "dan"/"gacha"/"kelishiladi" → salary).
 * Barcha maydon xatolari ketgach, umumiy "yuqoridagini tuzating" (`form`) xabari ham o'chadi.
 */
export function clearEditedErrors<E extends Partial<Record<string, string>>>(errors: E, changedKeys: string[], fieldOf: Partial<Record<string, string>>): E {
  const drop = new Set(changedKeys.map((k) => fieldOf[k]).filter((k): k is string => !!k) as (keyof E)[]);
  if (!drop.size || !Object.keys(errors).some((k) => drop.has(k as keyof E))) return errors;
  const next = { ...errors };
  for (const k of drop) delete next[k];
  if (Object.keys(next).every((k) => k === "form")) delete next.form;
  return next;
}
