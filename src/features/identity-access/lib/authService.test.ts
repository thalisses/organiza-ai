import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn, signOut, signUp } from './authService';

const {
  onAuthStateChangeMock,
  signInWithPasswordMock,
  signOutMock,
  signUpMock,
} = vi.hoisted(() => ({
  onAuthStateChangeMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
      signUp: signUpMock,
    },
  }),
}));

const validAvailability = [
  { dayOfWeek: 1 as const, startsAt: '09:00', endsAt: '12:00' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signUp', () => {
  it('normalizes WhatsApp and sends only participant fields to Auth metadata', async () => {
    signUpMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    await signUp({
      name: '  Participante Um  ',
      whatsapp: '(44) 99999-1234',
      email: ' pessoa@example.test ',
      password: 'test-password',
      availability: [
        { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
        { dayOfWeek: 1, startsAt: '14:00', endsAt: '18:00' },
      ],
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'pessoa@example.test',
      password: 'test-password',
      options: {
        data: {
          name: 'Participante Um',
          whatsapp_e164: '+5544999991234',
          availability_windows: [
            { day_of_week: 1, starts_at: '09:00', ends_at: '12:00' },
            { day_of_week: 1, starts_at: '14:00', ends_at: '18:00' },
          ],
        },
      },
    });
  });

  it('rejects signup without a weekly availability window before contacting Auth', async () => {
    await expect(
      signUp({
        name: 'Participante Um',
        whatsapp: '(44) 99999-1234',
        email: 'pessoa@example.test',
        password: 'test-password',
        availability: [],
      }),
    ).rejects.toThrow('Informe ao menos um intervalo semanal válido.');

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects invalid weekly intervals before contacting Auth', async () => {
    await expect(
      signUp({
        name: 'Participante Um',
        whatsapp: '(44) 99999-1234',
        email: 'pessoa@example.test',
        password: 'test-password',
        availability: [{ dayOfWeek: 1, startsAt: '18:00', endsAt: '09:00' }],
      }),
    ).rejects.toThrow('Cada intervalo deve terminar depois do horário inicial.');

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid WhatsApp number before contacting Auth', async () => {
    await expect(
      signUp({
        name: 'Participante Um',
        whatsapp: '123',
        email: 'pessoa@example.test',
        password: 'test-password',
        availability: validAvailability,
      }),
    ).rejects.toThrow('Informe um WhatsApp válido com DDD.');

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('replaces provider details with a generic signup error', async () => {
    signUpMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('internal provider detail'),
    });

    await expect(
      signUp({
        name: 'Participante Um',
        whatsapp: '(44) 99999-1234',
        email: 'pessoa@example.test',
        password: 'test-password',
        availability: validAvailability,
      }),
    ).rejects.toThrow('Não foi possível criar sua conta. Confira os dados e tente novamente.');
  });
});

describe('signIn', () => {
  it('trims the email and preserves the password', async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    await signIn({ email: ' pessoa@example.test ', password: '  secret  ' });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'pessoa@example.test',
      password: '  secret  ',
    });
  });

  it('replaces provider details with a generic login error', async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('internal provider detail'),
    });

    await expect(
      signIn({ email: 'pessoa@example.test', password: 'wrong-password' }),
    ).rejects.toThrow('Não foi possível entrar. Confira seu e-mail e senha.');
  });
});

describe('signOut', () => {
  it('ends the current Supabase Auth session', async () => {
    signOutMock.mockResolvedValueOnce({ error: null });

    await signOut();

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('subscribeToAuthState', () => {
  it('reports the restored session and unsubscribes on cleanup', async () => {
    const unsubscribeMock = vi.fn();
    const sessionListener = vi.fn();
    onAuthStateChangeMock.mockReturnValueOnce({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });
    const { subscribeToAuthState } = await import('./authService');

    const unsubscribe = subscribeToAuthState(sessionListener);
    const authCallback = onAuthStateChangeMock.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void;
    authCallback('INITIAL_SESSION', { user: { id: 'participant-1' } });
    authCallback('SIGNED_OUT', null);
    unsubscribe();

    expect(sessionListener).toHaveBeenNthCalledWith(1, true);
    expect(sessionListener).toHaveBeenNthCalledWith(2, false);
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
