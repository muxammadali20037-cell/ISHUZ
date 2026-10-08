/**
 * Moderatsiya tartibi (sof modul; AI chaqiruvlari tashqaridan beriladi — testlarda soxta):
 *  1. matn normalizatsiya + tezkor qoidalar ("block" bo'lsa — darhol rad etiladi, AI'ga yuborilmaydi);
 *  2. AI: ishga aloqadorlik va taqiqlangan mazmun (matn + havolalar);
 *  3. har bir rasm alohida: AI (rasm + undagi yozuv), yozuv yana qoidalardan o'tadi;
 *  4. eng og'ir natija tanlanadi (reject > review > allow); chetlab o'tishga urinish bo'lsa "allow" bo'lmaydi.
 * AI ishlamasa yoki javobi noto'g'ri bo'lsa — xato qaytariladi (e'lon "pending" qoladi va keyin qayta tekshiriladi).
 */
import { extractLinks } from "./normalize";
import { checkRules, type ModerationCategory, type RuleHit } from "./rules";
import { cleanVerdict, type CleanVerdict, type Decision } from "./verdict";

export interface ModerationImage {
  /** maydon nomi: photo | logo */
  key: string;
  url: string;
}

export interface ModerationInput {
  entity: "vacancy" | "worker";
  locale: string;
  fields: Record<string, string>;
  images: ModerationImage[];
  /** bazadagi qo'shimcha signallar (masalan scam_words) */
  signals: string[];
}

export interface ModerationResult {
  decision: Decision;
  category: ModerationCategory;
  reasonCode: string;
  userMessage: string;
  flaggedFields: string[];
  signals: string[];
  source: "rules" | "ai";
}

export interface EngineDeps {
  aiAvailable: boolean;
  /** AI sozlanmaganda: "review" — admin navbatiga; "rules" — qoidalardan o'tsa ruxsat */
  withoutAi: "review" | "rules";
  textVerdict: (system: { entity: ModerationInput["entity"]; locale: string; fields: Record<string, string>; links: string[]; signals: string[] }) => Promise<unknown>;
  imageVerdict: (image: ModerationImage, locale: string) => Promise<{ verdict: unknown; extractedText: string }>;
}

const RANK: Record<Decision, number> = { allow: 0, review: 1, reject: 2 };

function fromRule(hit: RuleHit, signals: string[]): ModerationResult {
  return {
    decision: "reject",
    category: hit.category === "injection" ? "uncertain" : hit.category,
    reasonCode: `rule_${hit.rule}`,
    userMessage: "",
    flaggedFields: [hit.field],
    signals,
    source: "rules",
  };
}

export async function runModerationEngine(input: ModerationInput, deps: EngineDeps): Promise<ModerationResult> {
  const links = Object.values(input.fields).flatMap((v) => extractLinks(v));
  const rules = checkRules(input.fields);
  const signals = Array.from(new Set([...input.signals, ...rules.hits.map((h) => `${h.rule}@${h.field}`)]));
  if (rules.block) return fromRule(rules.block, signals);

  if (!deps.aiAvailable) {
    const clean = rules.hits.length === 0;
    return {
      decision: deps.withoutAi === "rules" && clean ? "allow" : "review",
      category: deps.withoutAi === "rules" && clean ? "job_related" : "uncertain",
      reasonCode: "ai_unavailable",
      userMessage: "",
      flaggedFields: [],
      signals,
      source: "rules",
    };
  }

  const fieldKeys = Object.keys(input.fields);
  const text: CleanVerdict = cleanVerdict(
    await deps.textVerdict({ entity: input.entity, locale: input.locale, fields: input.fields, links, signals: rules.hits.map((h) => h.rule) }),
    fieldKeys,
  );
  let best: ModerationResult = { ...text, signals, source: "ai" };

  for (const image of input.images) {
    const { verdict, extractedText } = await deps.imageVerdict(image, input.locale);
    const v = cleanVerdict(verdict, ["image", image.key]);
    let result: ModerationResult = { ...v, flaggedFields: v.decision === "allow" ? [] : [image.key], signals, source: "ai" };
    // rasm ichidagi yozuv ham qoidalardan o'tadi
    if (extractedText.trim()) {
      const inner = checkRules({ [image.key]: extractedText });
      if (inner.block) result = fromRule(inner.block, signals);
      else if (inner.injection && result.decision === "allow") result = { ...result, decision: "review", category: "uncertain", reasonCode: "manipulation_attempt" };
    }
    if (RANK[result.decision] > RANK[best.decision]) best = result;
    if (best.decision === "reject") break;
  }

  if (rules.injection && best.decision === "allow") {
    best = { ...best, decision: "review", category: "uncertain", reasonCode: "manipulation_attempt", flaggedFields: rules.hits.filter((h) => h.category === "injection").map((h) => h.field) };
  }
  return best;
}
