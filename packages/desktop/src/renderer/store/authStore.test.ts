import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('setAuth stores token and user, sets isAuthenticated', () => {
    const user = { id: '1', nickname: 'Mel', avatarInitials: 'ME', isGuest: false };
    useAuthStore.getState().setAuth('jwt-token-123', user);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token-123');
    expect(state.user).toEqual(user);
  });

  it('logout clears auth state', () => {
    const user = { id: '1', nickname: 'Mel', avatarInitials: 'ME', isGuest: false };
    useAuthStore.getState().setAuth('jwt-token-123', user);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('handles guest user correctly', () => {
    const guest = { id: 'g1', nickname: 'Guest42', avatarInitials: 'GU', isGuest: true };
    useAuthStore.getState().setAuth('guest-token', guest);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.isGuest).toBe(true);
  });
});
