import { z } from "zod";

export const commonEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TEMPLATE_DIR: z.string().optional()
});
export type NodeEnv = z.infer<typeof commonEnvSchema>["NODE_ENV"];

const formatIssues = (issues: z.ZodIssue[]): string => issues.map((issue) => issue.message).join("; ");

export const parseEnv = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  raw: Record<string, unknown>,
  scope: string
): z.infer<TSchema> => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid ${scope} environment configuration: ${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
};

export const resolveNodeEnv = (rawNodeEnv: unknown): NodeEnv => {
  const parsed = commonEnvSchema.shape.NODE_ENV.safeParse(rawNodeEnv);
  return parsed.success ? parsed.data : "development";
};

export const buildDotenvFilePaths = (dotenvBase: string, nodeEnv: NodeEnv): string[] => [
  `${dotenvBase}.${nodeEnv}.local`,
  ...(nodeEnv !== "test" ? [`${dotenvBase}.local`] : []),
  `${dotenvBase}.${nodeEnv}`,
  dotenvBase
];
