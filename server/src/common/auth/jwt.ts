import { sign, type SignOptions, verify } from "jsonwebtoken";
import { z } from "zod";
import { DomainUserRoleSchema } from "@villanelle/ret-shared/domain";

const AccessJwtPayloadSchema = z.object({
  uuid: z.string().optional(),
  username: z.string(),
  instituteName: z.string(),
  email: z.string(),
  userRole: z.enum(DomainUserRoleSchema.options),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type AccessJwtPayload = z.infer<typeof AccessJwtPayloadSchema>;

type IssueAccessJwtInput = {
  payload: Omit<AccessJwtPayload, "iat" | "exp">;
  secret: string;
  expiresIn: string;
};

export const issueAccessJwt = ({ payload, secret, expiresIn }: IssueAccessJwtInput): string =>
  sign(payload, secret, { algorithm: "HS256", expiresIn } as SignOptions);

export const verifyAccessJwt = (token: string, secret: string): AccessJwtPayload => {
  const decoded = verify(token, secret, { algorithms: ["HS256"] });
  return AccessJwtPayloadSchema.parse(decoded);
};
