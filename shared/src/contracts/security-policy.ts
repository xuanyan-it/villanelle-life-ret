import { z } from "zod";

export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[^\s]{8,16}$/;
export const PASSWORD_POLICY_HINT =
  "8-16 chars, at least 1 uppercase, 1 lowercase, 1 digit, no spaces";

export const PasswordPolicySchema = z
  .string()
  .regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_HINT);

export const DEFAULT_IDLE_TIMEOUT_SECONDS = 24 * 60 * 60;
