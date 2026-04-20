import jwt from "jsonwebtoken";
import { User } from "../models/user";

const JWT_SECRET = process.env.JWT_SECRET || "melnet-dev-secret";
const JWT_EXPIRES_IN = "24h";

export interface JwtPayload {
  userId: string;
  nickname: string;
  isGuest: boolean;
}

export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    nickname: user.nickname,
    isGuest: user.isGuest,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
