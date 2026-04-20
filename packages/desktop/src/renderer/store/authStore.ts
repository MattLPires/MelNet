import { create } from 'zustand';

export interface AuthUser {
  id: string;
  nickname: string;
  avatarInitials: string;
  isGuest: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (token, user) => {
    set({ token, user, isAuthenticated: true, isLoading: false });
    // Persist session to SQLite (fire and forget)
    try {
      window.melnetDb?.session.save({
        userId: user.id,
        nickname: user.nickname,
        token,
        isGuest: user.isGuest,
        createdAt: new Date().toISOString(),
      });
    } catch { /* DB not available */ }
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
    try { window.melnetDb?.session.clear(); } catch { /* */ }
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));
