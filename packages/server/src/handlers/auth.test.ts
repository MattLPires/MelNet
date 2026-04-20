import { describe, it, expect, beforeEach } from "vitest";
import { handleRegister, handleLogin, handleGuestLogin } from "./auth";
import { clearUsers } from "../store/user-store";
import { verifyToken } from "../utils/jwt";

beforeEach(() => {
  clearUsers();
});

describe("handleRegister", () => {
  it("registers a user with valid fields and returns JWT", async () => {
    const result = await handleRegister({
      nickname: "Player1",
      email: "player1@test.com",
      password: "secret123",
    });

    expect(result.type).toBe("register-success");
    const payload = result.payload as { token: string; user: Record<string, unknown> };
    expect(payload.token).toBeDefined();
    expect(payload.user.nickname).toBe("Player1");
    expect(payload.user.isGuest).toBe(false);
    expect(payload.user.avatarInitials).toBe("PL");

    // Token should be valid
    const decoded = verifyToken(payload.token);
    expect(decoded.nickname).toBe("Player1");
    expect(decoded.isGuest).toBe(false);
  });

  it("returns error when fields are missing", async () => {
    const result = await handleRegister({ nickname: "Player1" });
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("returns error when email is already registered", async () => {
    await handleRegister({ nickname: "P1", email: "dup@test.com", password: "pass" });
    const result = await handleRegister({ nickname: "P2", email: "dup@test.com", password: "pass2" });

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("EMAIL_IN_USE");
  });
});

describe("handleLogin", () => {
  it("logs in with valid credentials and returns JWT", async () => {
    await handleRegister({ nickname: "Player1", email: "p1@test.com", password: "secret" });
    const result = await handleLogin({ email: "p1@test.com", password: "secret" });

    expect(result.type).toBe("login-success");
    const payload = result.payload as { token: string; user: Record<string, unknown> };
    expect(payload.token).toBeDefined();
    expect(payload.user.nickname).toBe("Player1");
  });

  it("returns generic error for wrong email", async () => {
    const result = await handleLogin({ email: "nobody@test.com", password: "pass" });
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("INVALID_CREDENTIALS");
  });

  it("returns generic error for wrong password", async () => {
    await handleRegister({ nickname: "P1", email: "p1@test.com", password: "correct" });
    const result = await handleLogin({ email: "p1@test.com", password: "wrong" });

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("INVALID_CREDENTIALS");
  });

  it("returns error when fields are missing", async () => {
    const result = await handleLogin({ email: "p1@test.com" });
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });
});

describe("handleGuestLogin", () => {
  it("creates guest session with nickname and returns JWT with isGuest flag", () => {
    const result = handleGuestLogin({ nickname: "GuestBoy" });

    expect(result.type).toBe("guest-login-success");
    const payload = result.payload as { token: string; user: Record<string, unknown> };
    expect(payload.token).toBeDefined();
    expect(payload.user.nickname).toBe("GuestBoy");
    expect(payload.user.isGuest).toBe(true);

    const decoded = verifyToken(payload.token);
    expect(decoded.isGuest).toBe(true);
  });

  it("returns error when nickname is missing", () => {
    const result = handleGuestLogin({});
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });
});
