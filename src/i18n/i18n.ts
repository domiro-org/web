import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCommon from "../locales/zh-Hans/common.json";
import enCommon from "../locales/en-US/common.json";

i18n.use(initReactI18next).init({
  lng: "zh-Hans",
  fallbackLng: "en-US",
  supportedLngs: ["zh-Hans", "en-US"],
  resources: {
    "zh-Hans": { common: zhCommon },
    "en-US": { common: enCommon }
  },
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false }
});

export default i18n;
