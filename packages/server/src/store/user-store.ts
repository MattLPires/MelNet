import { v4 as uuidv4 } from "uuid";
import { User } from "../models/user";
import { hashPassword } from "../utils/password";

const users = new Map<string, User>();

function extractInitials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nickname.slice(0, 2).toUpperCase();
}

export async function createUser(
  nickname: string,
  email: string,
  password: string
): Promise<User> {
  const id = uuidv4();
  const passwordHash = await hashPassword(password);
  const avatarInitials = extractInitials(nickname);

  const user: User = {
    id,
    nickname,
    email: email.toLowerCase(),
    passwordHash,
    avatarInitials,
    isGuest: false,
  };

  users.set(id, user);
  return user;
}

export function createGuestUser(nickname: string): User {
  const id = uuidv4();
  const avatarInitials = extractInitials(nickname);

  const user: User = {
    id,
    nickname,
    email: "",
    passwordHash: "",
    avatarInitials,
    isGuest: true,
  };

  users.set(id, user);
  return user;
}

export function findByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase();
  for (const user of users.values()) {
    if (user.email === normalized) {
      return user;
    }
  }
  return undefined;
}

export function findById(id: string): User | undefined {
  return users.get(id);
}

/** Clear all users — useful for testing. */
export function clearUsers(): void {
  users.clear();
}
