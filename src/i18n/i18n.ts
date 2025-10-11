import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCommon from "../locales/zh-Hans/common.json";
import enCommon from "../locales/en-US/common.json";

const SUPPORTED_LANGUAGES = ["zh-Hans", "en-US"] as const;
const LANGUAGE_ALIASES: Record<string, (typeof SUPPORTED_LANGUAGES)[number]> = {
  "zh-hans": "zh-Hans",
  "zh-cn": "zh-Hans",
  zh: "zh-Hans",
  "en-us": "en-US",
  en: "en-US"
};

/**
 * 获取系统语言对应的支持语言，若无法匹配则回退至英文。
 */
const resolveDefaultLanguage = (): (typeof SUPPORTED_LANGUAGES)[number] => {
  if (typeof navigator === "undefined") {
    return "en-US";
  }

  const candidates = [...navigator.languages, navigator.language]
    .filter(Boolean)
    .map((lang) => lang.toLowerCase());

  for (const candidate of candidates) {
    if (SUPPORTED_LANGUAGES.includes(candidate as (typeof SUPPORTED_LANGUAGES)[number])) {
      return candidate as (typeof SUPPORTED_LANGUAGES)[number];
    }

    const alias = LANGUAGE_ALIASES[candidate];
    if (alias) {
      return alias;
    }

    const base = candidate.split("-")[0];
    const baseAlias = LANGUAGE_ALIASES[base];
    if (baseAlias) {
      return baseAlias;
    }
  }

  return "en-US";
};

i18n.use(initReactI18next).init({
  lng: resolveDefaultLanguage(),
  fallbackLng: "en-US",
  supportedLngs: [...SUPPORTED_LANGUAGES],
  resources: {
    "zh-Hans": { common: zhCommon },
    "en-US": { common: enCommon }
  },
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false }
});

export default i18n;
