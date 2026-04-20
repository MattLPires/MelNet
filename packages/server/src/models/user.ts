export interface User {
  id: string;
  nickname: string;
  email: string;
  passwordHash: string;
  avatarInitials: string;
  isGuest: boolean;
}
