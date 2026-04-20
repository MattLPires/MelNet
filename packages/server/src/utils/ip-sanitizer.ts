/**
 * IP Sanitizer — ensures real IPs never leak in WebSocket responses.
 *
 * Virtual IPs (10.x.x.x) are safe to expose; all other IPv4 addresses
 * are replaced with "[REDACTED]".
 *
 * Validates: Requirements 8.1, 8.3
 */

// Matches IPv4 addresses but NOT those starting with 10.
// Negative lookahead excludes the 10.0.0.0/8 range.
const REAL_IP_REGEX = /\b(?!10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

/** Returns true if the IP is in the 10.0.0.0/8 virtual range. */
export function isVirtualIp(ip: string): boolean {
  return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/** Recursively sanitize an object/string, replacing real IPs with "[REDACTED]". */
export function sanitizePayload<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(REAL_IP_REGEX, "[REDACTED]") as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizePayload(val);
    }
    return result as T;
  }

  // numbers, booleans, null, undefined — pass through
  return value;
}
