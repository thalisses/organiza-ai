import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AvailabilityManager from './AvailabilityManager';

const { loadAvailabilityMock, replaceAvailabilityMock } = vi.hoisted(() => ({
  loadAvailabilityMock: vi.fn(),
  replaceAvailabilityMock: vi.fn(),
}));

vi.mock('../lib/availabilityService', () => ({
  loadMyAvailability: loadAvailabilityMock,
  replaceMyAvailability: replaceAvailabilityMock,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  loadAvailabilityMock.mockResolvedValue([
    { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
  ]);
  replaceAvailabilityMock.mockResolvedValue([
    { dayOfWeek: 1, startsAt: '09:00', endsAt: '13:00' },
  ]);
});

describe('AvailabilityManager', () => {
  it('loads and saves edits to the signed-in participant schedule', async () => {
    const user = userEvent.setup();
    render(<AvailabilityManager />);

    const mondayInterval = await screen.findByRole('group', { name: 'Intervalo 1' });
    const endTime = within(mondayInterval).getByLabelText('Horário final');
    expect((endTime as HTMLInputElement).value).toBe('12:00');
    fireEvent.change(endTime, { target: { value: '13:00' } });
    await user.click(screen.getByRole('button', { name: 'Salvar disponibilidade' }));

    expect(replaceAvailabilityMock).toHaveBeenCalledWith([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '13:00' },
    ]);
    expect(await screen.findByText('Disponibilidade atualizada.')).toBeTruthy();
  });

  it('adds the same interval to multiple days and preserves the loaded schedule', async () => {
    const user = userEvent.setup();
    render(<AvailabilityManager />);

    const newInterval = await screen.findByRole('group', { name: 'Novo intervalo' });
    await user.click(within(newInterval).getByRole('button', { name: 'Terça-feira' }));
    await user.click(within(newInterval).getByRole('button', { name: 'Quarta-feira' }));
    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '14:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '16:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar disponibilidade' }));

    expect(replaceAvailabilityMock).toHaveBeenCalledWith([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
      { dayOfWeek: 2, startsAt: '14:00', endsAt: '16:00' },
      { dayOfWeek: 3, startsAt: '14:00', endsAt: '16:00' },
    ]);
  });
});