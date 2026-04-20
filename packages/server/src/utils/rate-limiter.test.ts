import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, chatRateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // 5 attempts per 60 seconds (matching login config)
    limiter = new RateLimiter(5, 60_000);
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("192.168.1.1");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the 6th request within the window", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("192.168.1.1");
    }
    const result = limiter.check("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
    expect(result.retryAfterMs!).toBeLessThanOrEqual(60_000);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("client-a");
    }
    // client-a is now blocked
    expect(limiter.check("client-a").allowed).toBe(false);
    // client-b should still be allowed
    expect(limiter.check("client-b").allowed).toBe(true);
  });

  it("resets a specific key", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("192.168.1.1");
    }
    expect(limiter.check("192.168.1.1").allowed).toBe(false);

    limiter.reset("192.168.1.1");
    expect(limiter.check("192.168.1.1").allowed).toBe(true);
  });

  it("allows requests again after the window expires", () => {
    // Use a short window for this test
    const shortLimiter = new RateLimiter(2, 50);

    shortLimiter.check("key");
    shortLimiter.check("key");
    expect(shortLimiter.check("key").allowed).toBe(false);

    // Wait for the window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(shortLimiter.check("key").allowed).toBe(true);
        resolve();
      }, 60);
    });
  });
});

describe("chatRateLimiter", () => {
  it("is an instance of RateLimiter", () => {
    expect(chatRateLimiter).toBeInstanceOf(RateLimiter);
  });

  it("allows 30 messages then blocks", () => {
    // Use a fresh limiter with same config to avoid polluting the singleton
    const limiter = new RateLimiter(30, 30_000);
    for (let i = 0; i < 30; i++) {
      expect(limiter.check("user-1").allowed).toBe(true);
    }
    const result = limiter.check("user-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeLessThanOrEqual(30_000);
  });
});
