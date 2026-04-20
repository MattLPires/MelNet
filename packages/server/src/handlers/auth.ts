import { User } from "../models/user";
import { createUser, createGuestUser, findByEmail } from "../store/user-store";
import { verifyPassword } from "../utils/password";
import { generateToken } from "../utils/jwt";

interface AuthResponse {
  type: string;
  payload: Record<string, unknown>;
}

function userPayload(user: User) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarInitials: user.avatarInitials,
    isGuest: user.isGuest,
  };
}

function errorResponse(code: string, message: string): AuthResponse {
  return { type: "error", payload: { code, message } };
}

export async function handleRegister(payload: {
  nickname?: string;
  email?: string;
  password?: string;
}): Promise<AuthResponse> {
  const { nickname, email, password } = payload;

  if (!nickname || !email || !password) {
    return errorResponse("MISSING_FIELDS", "All fields are required: nickname, email, password");
  }

  const existing = findByEmail(email);
  if (existing) {
    return errorResponse("EMAIL_IN_USE", "This email is already registered");
  }

  const user = await createUser(nickname, email, password);
  const token = generateToken(user);

  return {
    type: "register-success",
    payload: { token, user: userPayload(user) },
  };
}

export async function handleLogin(payload: {
  email?: string;
  password?: string;
}): Promise<AuthResponse> {
  const { email, password } = payload;

  if (!email || !password) {
    return errorResponse("MISSING_FIELDS", "All fields are required: email, password");
  }

  const user = findByEmail(email);
  if (!user) {
    return errorResponse("INVALID_CREDENTIALS", "Invalid credentials");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return errorResponse("INVALID_CREDENTIALS", "Invalid credentials");
  }

  const token = generateToken(user);

  return {
    type: "login-success",
    payload: { token, user: userPayload(user) },
  };
}

export function handleGuestLogin(payload: {
  nickname?: string;
}): AuthResponse {
  const { nickname } = payload;

  if (!nickname) {
    return errorResponse("MISSING_FIELDS", "Nickname is required");
  }

  const user = createGuestUser(nickname);
  const token = generateToken(user);

  return {
    type: "guest-login-success",
    payload: { token, user: userPayload(user) },
  };
}
