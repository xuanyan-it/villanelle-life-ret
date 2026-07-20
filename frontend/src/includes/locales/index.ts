import enFooter from "./modules/footer/enUS.json";
import zhFooter from "./modules/footer/zhCN.json";
import enHeader from "./modules/header/enUS.json";
import zhHeader from "./modules/header/zhCN.json";
import enLoginPanel from "./modules/loginPanel/enUS.json";
import zhLoginPanel from "./modules/loginPanel/zhCN.json";
import enModelLoading from "./modules/modelLoading/enUS.json";
import zhModelLoading from "./modules/modelLoading/zhCN.json";
import enNewRecord from "./modules/newRecord/enUS.json";
import zhNewRecord from "./modules/newRecord/zhCN.json";
import enNotification from "./modules/notification/enUS.json";
import zhNotification from "./modules/notification/zhCN.json";
import enRecordTable from "./modules/recordTable/enUS.json";
import zhRecordTable from "./modules/recordTable/zhCN.json";
import enReportPreviewer from "./modules/reportPreviewer/enUS.json";
import zhReportPreviewer from "./modules/reportPreviewer/zhCN.json";
import enSettings from "./modules/settings/enUS.json";
import zhSettings from "./modules/settings/zhCN.json";
import enServiceHealth from "./modules/serviceHealth/enUS.json";
import zhServiceHealth from "./modules/serviceHealth/zhCN.json";
export const enModules = {
  ...enHeader,
  ...enFooter,
  ...enNewRecord,
  ...enRecordTable,
  ...enReportPreviewer,
  ...enSettings,
  ...enLoginPanel,
  ...enNotification,
  ...enModelLoading,
  ...enServiceHealth,
};
export const zhModules = {
  ...zhHeader,
  ...zhFooter,
  ...zhNewRecord,
  ...zhRecordTable,
  ...zhReportPreviewer,
  ...zhSettings,
  ...zhLoginPanel,
  ...zhNotification,
  ...zhModelLoading,
  ...zhServiceHealth,
};
export const i18nResources = {
  en: {
    translation: enModules,
  },
  zh: {
    translation: zhModules,
  },
} as const;
