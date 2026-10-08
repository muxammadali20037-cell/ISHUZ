export type AlertRole = "worker" | "employer";

/** off — o'chiq; needs_bot — Telegram bog'lanmagan / bot hali yozolmaydi; active — xabar yuboriladi */
export type AlertStatus = "off" | "needs_bot" | "active";

export interface AlertSubscription {
  role: AlertRole;
  enabled: boolean;
  status: AlertStatus;
  mode: "instant" | "digest";
  professionNodeId: string | null;
  regionId: string | null;
  salaryMin: number | null;
  schedules: string[];
  vacancyIds: string[];
  pausedReason: string | null;
}
