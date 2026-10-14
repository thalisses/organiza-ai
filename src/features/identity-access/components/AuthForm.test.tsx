import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';

const {
  signInMock,
  signOutMock,
  signUpMock,
  subscribeToAuthStateMock,
  loadAvailabilityMock,
  replaceAvailabilityMock,
  loadSectorLeaderCandidatesMock,
  setSectorLeaderMock,
} = vi.hoisted(() => ({
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
  signUpMock: vi.fn(),
  subscribeToAuthStateMock: vi.fn(),
  loadAvailabilityMock: vi.fn(),
  replaceAvailabilityMock: vi.fn(),
  loadSectorLeaderCandidatesMock: vi.fn(),
  setSectorLeaderMock: vi.fn(),
}));

vi.mock('../lib/authService', () => ({
  signIn: signInMock,
  signOut: signOutMock,
  signUp: signUpMock,
  subscribeToAuthState: subscribeToAuthStateMock,
}));

vi.mock('../lib/availabilityService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/availabilityService')>();
  return {
    ...actual,
    loadMyAvailability: loadAvailabilityMock,
    replaceMyAvailability: replaceAvailabilityMock,
  };
});

vi.mock('../lib/roleManagementService', () => ({
  loadSectorLeaderCandidates: loadSectorLeaderCandidatesMock,
  setSectorLeader: setSectorLeaderMock,
}));

vi.mock('../../territory-map/components/CityMap', () => ({
  default: () => <section aria-label="Mapa urbano principal de Maringá" />,
}));

vi.mock('../../acts/components/ActManagement', () => ({
  default: () => <section aria-label="Gestão de atos" />,
}));

vi.mock('../../acts/components/ActAgenda', () => ({
  default: () => <section aria-label="Agenda de atos" />,
}));

vi.mock('../../material-points/components/MaterialPointManagement', () => ({
  default: () => <section aria-label="Gestão de locais de retirada" />,
}));

vi.mock('../../material-points/components/MaterialPointDiscovery', () => ({
  default: () => <section aria-label="Descoberta de locais de retirada" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  signInMock.mockResolvedValue({ session: { user: { id: 'participant-1' } } });
  signOutMock.mockResolvedValue(undefined);
  signUpMock.mockResolvedValue({ session: { user: { id: 'participant-1' } } });
  loadAvailabilityMock.mockResolvedValue([]);
  replaceAvailabilityMock.mockResolvedValue([]);
  loadSectorLeaderCandidatesMock.mockResolvedValue({ isCityLeader: false, candidates: [] });
  setSectorLeaderMock.mockResolvedValue(undefined);
  subscribeToAuthStateMock.mockImplementation(
    (onSessionChange: (hasSession: boolean) => void) => {
      onSessionChange(false);
      return vi.fn();
    },
  );
});

describe('AuthForm', () => {
  it('starts in login mode with visible, associated labels', () => {
    render(<AuthForm />);

    expect(screen.getByText('★')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Organiza AI' })).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.queryByLabelText('Seu nome')).toBeNull();
  });

  it('shows and releases a restored session subscription', async () => {
    const unsubscribe = vi.fn();
    let updateSession: (hasSession: boolean) => void = () => {};
    subscribeToAuthStateMock.mockImplementationOnce(
      (onSessionChange: (hasSession: boolean) => void) => {
        updateSession = onSessionChange;
        onSessionChange(true);
        return unsubscribe;
      },
    );
    const { unmount } = render(<AuthForm />);

    expect(screen.getByText('Sessão ativa.')).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Mapa urbano principal de Maringá' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Gestão de atos' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Agenda de atos' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Gestão de locais de retirada' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Descoberta de locais de retirada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();

    act(() => updateSession(false));
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('shows required registration fields when switching to signup', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Criar conta' })).toBeTruthy();
    expect(screen.getByLabelText('Seu nome')).toBeTruthy();
    expect(screen.getByLabelText('WhatsApp')).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Disponibilidade semanal' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Novo intervalo' })).toBeTruthy();
  });

  it('requires all signup fields before submission', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByLabelText('Seu nome').hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText('WhatsApp').hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText('E-mail').hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText('Senha').hasAttribute('required')).toBe(true);
  });

  it('rejects signup without a weekly availability window', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Participante Um');
    await user.type(screen.getByLabelText('WhatsApp'), '(44) 99999-1234');
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test');
    await user.type(screen.getByLabelText('Senha'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('shows a disabled pending action until login completes', async () => {
    const user = userEvent.setup();
    let resolveSignIn!: (result: { session: null }) => void;
    signInMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSignIn = resolve; }),
    );
    render(<AuthForm />);
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test');
    await user.type(screen.getByLabelText('Senha'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Entrar na conta' }));

    expect((screen.getByRole('button', { name: 'Aguarde…' }) as HTMLButtonElement).disabled).toBe(true);

    resolveSignIn({ session: null });
    expect(await screen.findByText('Sessão iniciada.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar na conta' })).toBeTruthy();
  });

  it('submits signup details and reflects the active session', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Participante Um');
    await user.type(screen.getByLabelText('WhatsApp'), '(44) 99999-1234');
    const newInterval = screen.getByRole('group', { name: 'Novo intervalo' });
    await user.click(within(newInterval).getByRole('button', { name: 'Segunda-feira' }));
    await user.click(within(newInterval).getByRole('button', { name: 'Quarta-feira' }));
    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '09:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '12:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test');
    await user.type(screen.getByLabelText('Senha'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(signUpMock).toHaveBeenCalledWith({
      name: 'Participante Um',
      whatsapp: '(44) 99999-1234',
      email: 'pessoa@example.test',
      password: 'test-password',
      availability: [
        { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
        { dayOfWeek: 3, startsAt: '09:00', endsAt: '12:00' },
      ],
    });
    expect(await screen.findByText('Sessão iniciada.')).toBeTruthy();
  });

  it('shows a generic error returned by the Auth service', async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValueOnce(new Error('Não foi possível entrar. Confira seu e-mail e senha.'));
    render(<AuthForm />);
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test');
    await user.type(screen.getByLabelText('Senha'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Entrar na conta' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('stack trace')).toBeNull();
  });

  it('signs out and returns to login mode', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Participante Um');
    await user.type(screen.getByLabelText('WhatsApp'), '(44) 99999-1234');
    const newInterval = screen.getByRole('group', { name: 'Novo intervalo' });
    await user.click(within(newInterval).getByRole('button', { name: 'Segunda-feira' }));
    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '09:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '12:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test');
    await user.type(screen.getByLabelText('Senha'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));
    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 2, name: 'Entrar na conta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar', pressed: true })).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
  });
});
