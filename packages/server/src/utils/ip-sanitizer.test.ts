import { describe, it, expect } from "vitest";
import { sanitizePayload, isVirtualIp } from "./ip-sanitizer";

describe("isVirtualIp", () => {
  it("returns true for 10.x.x.x addresses", () => {
    expect(isVirtualIp("10.0.0.1")).toBe(true);
    expect(isVirtualIp("10.255.255.254")).toBe(true);
  });

  it("returns false for non-virtual IPs", () => {
    expect(isVirtualIp("192.168.1.1")).toBe(false);
    expect(isVirtualIp("8.8.8.8")).toBe(false);
    expect(isVirtualIp("172.16.0.1")).toBe(false);
  });
});

describe("sanitizePayload", () => {
  it("redacts real IPs from strings", () => {
    expect(sanitizePayload("connected from 192.168.1.100")).toBe(
      "connected from [REDACTED]",
    );
    expect(sanitizePayload("server at 8.8.8.8:3000")).toBe(
      "server at [REDACTED]:3000",
    );
  });

  it("preserves virtual IPs (10.x.x.x)", () => {
    expect(sanitizePayload("your ip is 10.0.1.5")).toBe("your ip is 10.0.1.5");
  });

  it("handles mixed real and virtual IPs", () => {
    const input = "real 192.168.0.1 virtual 10.0.0.3";
    expect(sanitizePayload(input)).toBe("real [REDACTED] virtual 10.0.0.3");
  });

  it("sanitizes nested objects recursively", () => {
    const input = {
      user: { ip: "172.16.0.5", virtualIp: "10.0.0.2" },
      message: "hello",
    };
    const result = sanitizePayload(input);
    expect(result.user.ip).toBe("[REDACTED]");
    expect(result.user.virtualIp).toBe("10.0.0.2");
    expect(result.message).toBe("hello");
  });

  it("sanitizes arrays", () => {
    const input = ["10.0.0.1", "192.168.1.1", "hello"];
    const result = sanitizePayload(input);
    expect(result).toEqual(["10.0.0.1", "[REDACTED]", "hello"]);
  });

  it("passes through non-string primitives unchanged", () => {
    expect(sanitizePayload(42)).toBe(42);
    expect(sanitizePayload(true)).toBe(true);
    expect(sanitizePayload(null)).toBe(null);
  });
});
