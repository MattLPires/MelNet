interface AttemptRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export class RateLimiter {
  private attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record) {
      this.attempts.set(key, { timestamps: [now] });
      return { allowed: true };
    }

    // Remove timestamps outside the current window
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < this.windowMs
    );

    if (record.timestamps.length >= this.maxAttempts) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = this.windowMs - (now - oldestInWindow);
      return { allowed: false, retryAfterMs };
    }

    record.timestamps.push(now);
    return { allowed: true };
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Login rate limiter: 5 attempts per 60 seconds
export const loginRateLimiter = new RateLimiter(5, 60_000);

// Room join rate limiter: 10 attempts per 5 minutes (block for 5 min when exceeded)
export const roomJoinRateLimiter = new RateLimiter(10, 300_000);

// Chat rate limiter: 30 messages per 30 seconds (block for 30s when exceeded)
export const chatRateLimiter = new RateLimiter(30, 30_000);
