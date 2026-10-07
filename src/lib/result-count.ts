/** Qidiruv natijalari soni: katta hajmda server cheklangan oynani sanaydi — chegaraga yetsa "10 000+" */
export const JOBS_COUNT_CAP = 10000;
export const WORKERS_COUNT_CAP = 5000;

export function resultCount(total: number, cap: number): string | number {
  return total >= cap ? `${new Intl.NumberFormat("ru-RU").format(cap)}+` : total;
}
