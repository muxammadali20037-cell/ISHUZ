/** TOP vakansiya hozir amaldami (server komponentlarda; mijoz moduli emas) */
export function featuredNow(isFeatured: boolean, featuredUntil: string | null, now = Date.now()): boolean {
  return isFeatured && (!featuredUntil || new Date(featuredUntil).getTime() > now);
}
