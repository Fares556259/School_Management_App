import { en } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";

export const translations = {
  en,
  fr,
  ar,
};

export type Locale = keyof typeof translations;
export type TranslationType = typeof en;
export type TranslationKey = keyof TranslationType;
