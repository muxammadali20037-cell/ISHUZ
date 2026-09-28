/**
 * Barcha tarjima fayllari. Har modul o'z namespace faylida:
 *   messages/uz/<namespace>.json, messages/ru/<namespace>.json
 * Kalit: "namespace.path.to.key". Ingliz tili qo'shish: messages/en/* + LOCALES ga 'en'.
 */
import type { Locale } from "./config";

import uzCommon from "../../../messages/uz/common.json";
import uzAuth from "../../../messages/uz/auth.json";
import uzOnboarding from "../../../messages/uz/onboarding.json";
import uzJobs from "../../../messages/uz/jobs.json";
import uzWorkers from "../../../messages/uz/workers.json";
import uzEmployer from "../../../messages/uz/employer.json";
import uzApplications from "../../../messages/uz/applications.json";
import uzChat from "../../../messages/uz/chat.json";
import uzProfile from "../../../messages/uz/profile.json";
import uzAdmin from "../../../messages/uz/admin.json";
import uzAi from "../../../messages/uz/ai.json";
import uzPromo from "../../../messages/uz/promo.json";
import uzBilling from "../../../messages/uz/billing.json";
import uzWelcome from "../../../messages/uz/welcome.json";
import uzContacts from "../../../messages/uz/contacts.json";
import uzCv from "../../../messages/uz/cv.json";
import uzBot from "../../../messages/uz/bot.json";
import uzLegal from "../../../messages/uz/legal.json";
import uzVacancies from "../../../messages/uz/vacancies.json";
import uzOffers from "../../../messages/uz/offers.json";
import uzNotifications from "../../../messages/uz/notifications.json";
import uzSaved from "../../../messages/uz/saved.json";
import uzEnums from "../../../messages/uz/enums.json";

import ruCommon from "../../../messages/ru/common.json";
import ruAuth from "../../../messages/ru/auth.json";
import ruOnboarding from "../../../messages/ru/onboarding.json";
import ruJobs from "../../../messages/ru/jobs.json";
import ruWorkers from "../../../messages/ru/workers.json";
import ruEmployer from "../../../messages/ru/employer.json";
import ruApplications from "../../../messages/ru/applications.json";
import ruChat from "../../../messages/ru/chat.json";
import ruProfile from "../../../messages/ru/profile.json";
import ruAdmin from "../../../messages/ru/admin.json";
import ruAi from "../../../messages/ru/ai.json";
import ruPromo from "../../../messages/ru/promo.json";
import ruBilling from "../../../messages/ru/billing.json";
import ruWelcome from "../../../messages/ru/welcome.json";
import ruContacts from "../../../messages/ru/contacts.json";
import ruCv from "../../../messages/ru/cv.json";
import ruBot from "../../../messages/ru/bot.json";
import ruLegal from "../../../messages/ru/legal.json";
import ruVacancies from "../../../messages/ru/vacancies.json";
import ruOffers from "../../../messages/ru/offers.json";
import ruNotifications from "../../../messages/ru/notifications.json";
import ruSaved from "../../../messages/ru/saved.json";
import ruEnums from "../../../messages/ru/enums.json";

export const messages = {
  uz: {
    common: uzCommon,
    auth: uzAuth,
    onboarding: uzOnboarding,
    jobs: uzJobs,
    workers: uzWorkers,
    employer: uzEmployer,
    applications: uzApplications,
    chat: uzChat,
    profile: uzProfile,
    admin: uzAdmin,
    vacancies: uzVacancies,
    offers: uzOffers,
    notifications: uzNotifications,
    saved: uzSaved,
    enums: uzEnums,
    ai: uzAi,
    promo: uzPromo,
    billing: uzBilling,
    welcome: uzWelcome,
    contacts: uzContacts,
    cv: uzCv,
    bot: uzBot,
    legal: uzLegal,
  },
  ru: {
    common: ruCommon,
    auth: ruAuth,
    onboarding: ruOnboarding,
    jobs: ruJobs,
    workers: ruWorkers,
    employer: ruEmployer,
    applications: ruApplications,
    chat: ruChat,
    profile: ruProfile,
    admin: ruAdmin,
    vacancies: ruVacancies,
    offers: ruOffers,
    notifications: ruNotifications,
    saved: ruSaved,
    enums: ruEnums,
    ai: ruAi,
    promo: ruPromo,
    billing: ruBilling,
    welcome: ruWelcome,
    contacts: ruContacts,
    cv: ruCv,
    bot: ruBot,
    legal: ruLegal,
  },
} satisfies Record<Locale, Record<string, unknown>>;

export type Messages = (typeof messages)["uz"];

/** "common.actions.save" ko'rinishidagi barcha kalitlar (tip darajasida) */
type Paths<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: Paths<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type MessageKey = Paths<Messages>;
