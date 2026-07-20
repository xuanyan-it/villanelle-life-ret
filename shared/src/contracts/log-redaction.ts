const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_RE = /pass(word|hash)?|token|secret|authorization|cookie|set-cookie|api[-_]?key|jwt/i;

const redactString = (value: string): string => {
  let next = value;
  next = next.replace(/(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi, "$1[REDACTED]");
  next = next.replace(/\b(access_token|refresh_token|token)=([^;,\s]+)/gi, "$1=[REDACTED]");
  next = next.replace(
    /\b([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]{0,})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    "$1***@$3"
  );
  return next;
};

const sanitizeInternal = (value: unknown, keyHint: string | undefined, seen: WeakSet<object>): unknown => {
  if (keyHint && SENSITIVE_KEY_RE.test(keyHint)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value as object)) {
    return "[Circular]";
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInternal(item, undefined, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sanitizeInternal(nested, key, seen);
  }
  return output;
};

export const sanitizeLogValue = (value: unknown): unknown => {
  return sanitizeInternal(value, undefined, new WeakSet<object>());
};

export const sanitizeLogMessage = (message: string): string => {
  return redactString(message);
};
