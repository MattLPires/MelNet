import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AuthPage.module.css';
import { networkManager } from '../network/NetworkManager';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'register' | 'guest';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const WINDOW_MS = 60_000;

interface FieldErrors {
  nickname?: string;
  email?: string;
  password?: string;
}

const DEFAULT_SERVER_URL = 'ws://localhost:3001';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegister(nickname: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!nickname.trim()) errors.nickname = 'Nickname é obrigatório';
  if (!email.trim()) errors.email = 'E-mail é obrigatório';
  else if (!validateEmail(email)) errors.email = 'E-mail inválido';
  if (!password) errors.password = 'Senha é obrigatória';
  else if (password.length < 6) errors.password = 'Mínimo 6 caracteres';
  return errors;
}

function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'E-mail é obrigatório';
  else if (!validateEmail(email)) errors.email = 'E-mail inválido';
  if (!password) errors.password = 'Senha é obrigatória';
  return errors;
}

function validateGuest(nickname: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!nickname.trim()) errors.nickname = 'Nickname é obrigatório';
  return errors;
}

export { validateRegister, validateLogin, validateGuest, validateEmail, MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_SECONDS };

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const attemptTimestamps = useRef<number[]>([]);
  const [lockedOut, setLockedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startLockout = useCallback(() => {
    setLockedOut(true);
    setCountdown(LOCKOUT_SECONDS);
  }, []);

  useEffect(() => {
    if (!lockedOut) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); setLockedOut(false); attemptTimestamps.current = []; return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedOut]);

  const recordAttempt = (): boolean => {
    const now = Date.now();
    attemptTimestamps.current = attemptTimestamps.current.filter((t) => now - t < WINDOW_MS);
    attemptTimestamps.current.push(now);
    if (attemptTimestamps.current.length >= MAX_ATTEMPTS) { startLockout(); return true; }
    return false;
  };

  const resetForm = () => { setNickname(''); setEmail(''); setPassword(''); setErrors({}); setServerError(null); };
  const switchMode = (m: AuthMode) => { resetForm(); setMode(m); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (lockedOut) return;

    let fieldErrors: FieldErrors;
    if (mode === 'register') fieldErrors = validateRegister(nickname, email, password);
    else if (mode === 'login') fieldErrors = validateLogin(email, password);
    else fieldErrors = validateGuest(nickname);

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    try {
      if (!networkManager.connected) await networkManager.connect(DEFAULT_SERVER_URL);
      let result: { token: string; user: any };
      if (mode === 'register') result = await networkManager.register(nickname, email, password);
      else if (mode === 'login') result = await networkManager.login(email, password);
      else result = await networkManager.guestLogin(nickname);
      setAuth(result.token, result.user);
    } catch (err: any) {
      const wasLockedOut = recordAttempt();
      const code = err?.code as string | undefined;
      if (wasLockedOut) setServerError(`Muitas tentativas. Aguarde ${LOCKOUT_SECONDS}s.`);
      else if (code === 'EMAIL_IN_USE') setServerError('Este e-mail já está cadastrado.');
      else if (code === 'INVALID_CREDENTIALS') setServerError('Credenciais inválidas.');
      else if (code === 'RATE_LIMITED') setServerError(`Muitas tentativas. Tente novamente em breve.`);
      else setServerError(err?.message ?? 'Erro de conexão com o servidor.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        <div className={styles.brand}>
          <svg className={styles.logo} width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="var(--color-accent)" opacity="0.15"/>
            <polygon points="20,6 33,13 33,27 20,34 7,27 7,13" fill="none" stroke="var(--color-accent)" strokeWidth="1.5"/>
          </svg>
          <h1 className={styles.brandName}>MelNet</h1>
        </div>
        <p className={styles.brandTagline}>Rede LAN virtual segura para jogos multiplayer</p>
        <div className={styles.features}>
          <div className={styles.feature}><div className={styles.featureDot}/><span>IP real sempre oculto</span></div>
          <div className={styles.feature}><div className={styles.featureDot}/><span>Criptografia ponta-a-ponta</span></div>
          <div className={styles.feature}><div className={styles.featureDot}/><span>Salas isoladas por jogo</span></div>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.formContainer}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`} onClick={() => switchMode('login')}>Entrar</button>
            <button className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`} onClick={() => switchMode('register')}>Cadastrar</button>
            <button className={`${styles.tab} ${mode === 'guest' ? styles.tabActive : ''}`} onClick={() => switchMode('guest')}>Convidado</button>
          </div>

          {serverError && <p className={styles.serverError} role="alert">{serverError}</p>}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {(mode === 'register' || mode === 'guest') && (
              <div className={styles.field}>
                <label htmlFor="auth-nickname">Nickname</label>
                <input id="auth-nickname" type="text" placeholder={mode === 'guest' ? 'Nickname temporário' : 'Seu nickname'} value={nickname} onChange={(e) => setNickname(e.target.value)} className={errors.nickname ? styles.inputError : ''} />
                {errors.nickname && <span className={styles.fieldError}>{errors.nickname}</span>}
              </div>
            )}
            {mode !== 'guest' && (
              <>
                <div className={styles.field}>
                  <label htmlFor="auth-email">E-mail</label>
                  <input id="auth-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? styles.inputError : ''} />
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="auth-password">Senha</label>
                  <div className={styles.passwordWrap}>
                    <input id="auth-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={errors.password ? styles.inputError : ''} />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.5"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/></svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                </div>
              </>
            )}
            <button type="submit" className={styles.submitBtn} disabled={loading || lockedOut}>
              {loading ? 'Conectando...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Entrar como convidado'}
            </button>
          </form>

          {lockedOut && <p className={styles.rateLimitMsg} role="alert" data-testid="rate-limit-msg">Tente novamente em {countdown}s.</p>}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
