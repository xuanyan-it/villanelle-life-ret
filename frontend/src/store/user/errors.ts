export const USER_ERROR_CODES = {
  VERIFY_TOKEN_INVALID: "user/verify_token_invalid",
  VERIFY_TOKEN_FAILED_INTERNAL: "user/verify_token_failed_internal",
  CREATE_FAILED: "user/create_failed",
  CREATE_FAILED_INSTITUTE_EXISTS: "user/create_failed_institute_exists",
  CREATE_FAILED_EMAIL_EXISTS: "user/create_failed_email_exists",
  CREATE_FAILED_USERNAME_EXISTS: "user/create_failed_username_exists",
  LOGIN_FAILED: "user/login_failed",
} as const;
