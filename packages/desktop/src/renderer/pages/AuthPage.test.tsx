import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuthPage, { validateRegister, validateLogin, validateGuest, validateEmail, MAX_ATTEMPTS } from './AuthPage';

// --- Pure validation unit tests ---

describe('validateEmail', () => {
  it('returns true for valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  it('returns false for invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('noatsign')).toBe(false);
    expect(validateEmail('missing@domain')).toBe(false);
  });
});

describe('validateRegister', () => {
  it('returns no errors for valid input', () => {
    expect(validateRegister('nick', 'a@b.com', 'secret')).toEqual({});
  });
  it('returns errors for all empty fields', () => {
    const errs = validateRegister('', '', '');
    expect(errs.nickname).toBeDefined();
    expect(errs.email).toBeDefined();
    expect(errs.password).toBeDefined();
  });
  it('returns error for short password', () => {
    const errs = validateRegister('nick', 'a@b.com', '123');
    expect(errs.password).toBeDefined();
  });
  it('returns error for invalid email format', () => {
    const errs = validateRegister('nick', 'bad-email', 'secret');
    expect(errs.email).toBeDefined();
  });
});

describe('validateLogin', () => {
  it('returns no errors for valid input', () => {
    expect(validateLogin('a@b.com', 'secret')).toEqual({});
  });
  it('returns errors for empty fields', () => {
    const errs = validateLogin('', '');
    expect(errs.email).toBeDefined();
    expect(errs.password).toBeDefined();
  });
});

describe('validateGuest', () => {
  it('returns no errors for valid nickname', () => {
    expect(validateGuest('nick')).toEqual({});
  });
  it('returns error for empty nickname', () => {
    expect(validateGuest('').nickname).toBeDefined();
  });
});

// --- Component integration tests ---

describe('AuthPage component', () => {
  it('renders login form by default', () => {
    render(<AuthPage />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
  });

  it('switches to register form and shows nickname field', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Cadastrar'));
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('switches to guest mode and shows only nickname field', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Acessar como Convidado'));
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  });

  it('shows validation errors on empty login submit', () => {
    render(<AuthPage />);
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    expect(screen.getByText('E-mail é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
  });

  it('shows validation errors on empty register submit', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Cadastrar'));
    fireEvent.click(screen.getByText('Criar conta'));
    expect(screen.getByText('Nickname é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('E-mail é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
  });

  it('shows validation error on empty guest submit', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Acessar como Convidado'));
    fireEvent.click(screen.getByText('Entrar como Convidado'));
    expect(screen.getByText('Nickname é obrigatório')).toBeInTheDocument();
  });

  it('clears errors when switching modes', () => {
    render(<AuthPage />);
    // Trigger login errors by submitting the form
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    expect(screen.getByText('E-mail é obrigatório')).toBeInTheDocument();
    // Switch to register — errors should be gone
    fireEvent.click(screen.getByText('Cadastrar'));
    expect(screen.queryByText('E-mail é obrigatório')).not.toBeInTheDocument();
  });

  it('can navigate back from guest mode to login', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Acessar como Convidado'));
    fireEvent.click(screen.getByText('Voltar para Login / Cadastro'));
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
});


// --- Client-side rate limiting tests ---

// Mock the networkManager to simulate login failures
vi.mock('../network/NetworkManager', () => ({
  networkManager: {
    connected: true,
    connect: vi.fn(),
    login: vi.fn().mockRejectedValue(Object.assign(new Error('Invalid'), { code: 'INVALID_CREDENTIALS' })),
    register: vi.fn(),
    guestLogin: vi.fn(),
  },
}));

describe('AuthPage client-side rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function submitLoginForm() {
    const emailInput = screen.getByLabelText('E-mail');
    const passwordInput = screen.getByLabelText('Senha');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
  }

  it('disables submit button after 5 failed attempts', async () => {
    render(<AuthPage />);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await submitLoginForm();
    }

    const submitBtn = document.querySelector('button[type="submit"]')!;
    expect(submitBtn).toBeDisabled();
  });

  it('shows rate limit countdown message after lockout', async () => {
    render(<AuthPage />);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await submitLoginForm();
    }

    expect(screen.getByTestId('rate-limit-msg')).toBeInTheDocument();
    expect(screen.getByTestId('rate-limit-msg').textContent).toMatch(/Tente novamente em \d+s/);
  });

  it('countdown decrements over time', async () => {
    render(<AuthPage />);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await submitLoginForm();
    }

    const msg = screen.getByTestId('rate-limit-msg');
    expect(msg.textContent).toContain('60s');

    act(() => { vi.advanceTimersByTime(1000); });
    expect(msg.textContent).toContain('59s');

    act(() => { vi.advanceTimersByTime(1000); });
    expect(msg.textContent).toContain('58s');
  });

  it('re-enables form after countdown expires', async () => {
    render(<AuthPage />);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await submitLoginForm();
    }

    expect(document.querySelector('button[type="submit"]')).toBeDisabled();

    // Advance through the full 60-second lockout
    act(() => { vi.advanceTimersByTime(60_000); });

    expect(document.querySelector('button[type="submit"]')).not.toBeDisabled();
    expect(screen.queryByTestId('rate-limit-msg')).not.toBeInTheDocument();
  });
});
