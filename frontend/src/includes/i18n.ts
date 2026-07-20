import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nResources } from "./locales";
i18n.use(initReactI18next).init({
  resources: i18nResources,
  fallbackLng: "zh",
  debug: true,
  interpolation: {
    escapeValue: false,
  },
});
export default i18n;
