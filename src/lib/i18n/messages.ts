/**
 * Barcha tarjima fayllari. Har modul o'z namespace faylida:
 *   messages/uz/<namespace>.json, messages/ru/<namespace>.json
 * Kalit: "namespace.path.to.key". messages/en/* — ingliz tili.
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
import uzProfessions from "../../../messages/uz/professions.json";
import uzVacancies from "../../../messages/uz/vacancies.json";
import uzOffers from "../../../messages/uz/offers.json";
import uzNotifications from "../../../messages/uz/notifications.json";
import uzSaved from "../../../messages/uz/saved.json";
import uzEasy from "../../../messages/uz/easy.json";
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
import ruProfessions from "../../../messages/ru/professions.json";
import ruVacancies from "../../../messages/ru/vacancies.json";
import ruOffers from "../../../messages/ru/offers.json";
import ruNotifications from "../../../messages/ru/notifications.json";
import ruSaved from "../../../messages/ru/saved.json";
import ruEasy from "../../../messages/ru/easy.json";
import ruEnums from "../../../messages/ru/enums.json";

import enCommon from "../../../messages/en/common.json";
import enAuth from "../../../messages/en/auth.json";
import enOnboarding from "../../../messages/en/onboarding.json";
import enJobs from "../../../messages/en/jobs.json";
import enWorkers from "../../../messages/en/workers.json";
import enEmployer from "../../../messages/en/employer.json";
import enApplications from "../../../messages/en/applications.json";
import enChat from "../../../messages/en/chat.json";
import enProfile from "../../../messages/en/profile.json";
import enAdmin from "../../../messages/en/admin.json";
import enAi from "../../../messages/en/ai.json";
import enPromo from "../../../messages/en/promo.json";
import enBilling from "../../../messages/en/billing.json";
import enWelcome from "../../../messages/en/welcome.json";
import enContacts from "../../../messages/en/contacts.json";
import enCv from "../../../messages/en/cv.json";
import enBot from "../../../messages/en/bot.json";
import enLegal from "../../../messages/en/legal.json";
import enProfessions from "../../../messages/en/professions.json";
import enVacancies from "../../../messages/en/vacancies.json";
import enOffers from "../../../messages/en/offers.json";
import enNotifications from "../../../messages/en/notifications.json";
import enSaved from "../../../messages/en/saved.json";
import enEasy from "../../../messages/en/easy.json";
import enEnums from "../../../messages/en/enums.json";

import ozCommon from "../../../messages/oz/common.json";
import ozAuth from "../../../messages/oz/auth.json";
import ozOnboarding from "../../../messages/oz/onboarding.json";
import ozJobs from "../../../messages/oz/jobs.json";
import ozWorkers from "../../../messages/oz/workers.json";
import ozEmployer from "../../../messages/oz/employer.json";
import ozApplications from "../../../messages/oz/applications.json";
import ozChat from "../../../messages/oz/chat.json";
import ozProfile from "../../../messages/oz/profile.json";
import ozAdmin from "../../../messages/oz/admin.json";
import ozAi from "../../../messages/oz/ai.json";
import ozPromo from "../../../messages/oz/promo.json";
import ozBilling from "../../../messages/oz/billing.json";
import ozWelcome from "../../../messages/oz/welcome.json";
import ozContacts from "../../../messages/oz/contacts.json";
import ozCv from "../../../messages/oz/cv.json";
import ozBot from "../../../messages/oz/bot.json";
import ozLegal from "../../../messages/oz/legal.json";
import ozProfessions from "../../../messages/oz/professions.json";
import ozVacancies from "../../../messages/oz/vacancies.json";
import ozOffers from "../../../messages/oz/offers.json";
import ozNotifications from "../../../messages/oz/notifications.json";
import ozSaved from "../../../messages/oz/saved.json";
import ozEasy from "../../../messages/oz/easy.json";
import ozEnums from "../../../messages/oz/enums.json";

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
    easy: uzEasy,
    enums: uzEnums,
    ai: uzAi,
    promo: uzPromo,
    billing: uzBilling,
    welcome: uzWelcome,
    contacts: uzContacts,
    cv: uzCv,
    bot: uzBot,
    legal: uzLegal,
    professions: uzProfessions,
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
    easy: ruEasy,
    enums: ruEnums,
    ai: ruAi,
    promo: ruPromo,
    billing: ruBilling,
    welcome: ruWelcome,
    contacts: ruContacts,
    cv: ruCv,
    bot: ruBot,
    legal: ruLegal,
    professions: ruProfessions,
  },
  oz: {
    common: ozCommon,
    auth: ozAuth,
    onboarding: ozOnboarding,
    jobs: ozJobs,
    workers: ozWorkers,
    employer: ozEmployer,
    applications: ozApplications,
    chat: ozChat,
    profile: ozProfile,
    admin: ozAdmin,
    ai: ozAi,
    promo: ozPromo,
    billing: ozBilling,
    welcome: ozWelcome,
    contacts: ozContacts,
    cv: ozCv,
    bot: ozBot,
    legal: ozLegal,
    professions: ozProfessions,
    vacancies: ozVacancies,
    offers: ozOffers,
    notifications: ozNotifications,
    saved: ozSaved,
    easy: ozEasy,
    enums: ozEnums,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    onboarding: enOnboarding,
    jobs: enJobs,
    workers: enWorkers,
    employer: enEmployer,
    applications: enApplications,
    chat: enChat,
    profile: enProfile,
    admin: enAdmin,
    vacancies: enVacancies,
    offers: enOffers,
    notifications: enNotifications,
    saved: enSaved,
    easy: enEasy,
    enums: enEnums,
    ai: enAi,
    promo: enPromo,
    billing: enBilling,
    welcome: enWelcome,
    contacts: enContacts,
    cv: enCv,
    bot: enBot,
    legal: enLegal,
    professions: enProfessions,
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
