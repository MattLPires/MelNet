import { AuthUser } from '../store/authStore';

export type ServerMessage = {
  type: string;
  payload: Record<string, unknown>;
};

type MessageHandler = (message: ServerMessage) => void;

/**
 * Manages WebSocket connection with the MelNet relay server.
 * Handles auth flows: register, login, guest-login.
 */
export class NetworkManager {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private _url: string | null = null;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get url(): string | null {
    return this._url;
  }

  /**
   * Connect to the relay server.
   * Returns a promise that resolves when the connection is open.
   */
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this._url = url;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => resolve();

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data as string);
          this.dispatch(message);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._url = null;
  }

  /**
   * Register a new user account.
   * Resolves with { token, user } on success, rejects on error.
   */
  register(
    nickname: string,
    email: string,
    password: string
  ): Promise<{ token: string; user: AuthUser }> {
    return this.sendAuthMessage('register', { nickname, email, password }, 'register-success');
  }

  /**
   * Login with email and password.
   */
  login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    return this.sendAuthMessage('login', { email, password }, 'login-success');
  }

  /**
   * Login as a guest with a temporary nickname.
   */
  guestLogin(nickname: string): Promise<{ token: string; user: AuthUser }> {
    return this.sendAuthMessage('guest-login', { nickname }, 'guest-login-success');
  }

  /**
   * Register a handler for a specific message type.
   */
  on(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * Remove a handler for a specific message type.
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      this.messageHandlers.set(
        type,
        handlers.filter((h) => h !== handler)
      );
    }
  }

  /**
   * Send a raw message to the server.
   */
  send(type: string, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify({ type, payload }));
  }

  // --- Private helpers ---

  private dispatch(message: ServerMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((h) => h(message));
    }
  }

  private sendAuthMessage(
    type: string,
    payload: Record<string, unknown>,
    successType: string
  ): Promise<{ token: string; user: AuthUser }> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const onSuccess: MessageHandler = (msg) => {
        cleanup();
        const { token, user } = msg.payload as { token: string; user: AuthUser };
        resolve({ token, user });
      };

      const onError: MessageHandler = (msg) => {
        cleanup();
        const { message, code, retryAfterMs } = msg.payload as {
          message?: string;
          code?: string;
          retryAfterMs?: number;
        };
        const error = new Error(message ?? 'Authentication failed');
        (error as any).code = code;
        (error as any).retryAfterMs = retryAfterMs;
        reject(error);
      };

      const cleanup = () => {
        this.off(successType, onSuccess);
        this.off('error', onError);
      };

      this.on(successType, onSuccess);
      this.on('error', onError);

      this.ws.send(JSON.stringify({ type, payload }));
    });
  }
}

/** Singleton instance for the app */
export const networkManager = new NetworkManager();
