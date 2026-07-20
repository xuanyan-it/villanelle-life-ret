const TEMPLATE_FILE_ALIASES: Record<string, string> = {
  "template_zh-CN.csv": "template_zh-CN.csv",
  "template_zhCN.csv": "template_zh-CN.csv"
};

export const DEFAULT_TEMPLATE_FILENAME = "template_zh-CN.csv";

export const normalizeTemplateFilename = (requested?: string): string | null => {
  const normalized = (requested ?? "").trim();
  if (!normalized) {
    return DEFAULT_TEMPLATE_FILENAME;
  }
  return TEMPLATE_FILE_ALIASES[normalized] ?? null;
};
