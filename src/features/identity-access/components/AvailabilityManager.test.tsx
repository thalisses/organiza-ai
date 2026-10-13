import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    const endTime = await screen.findByLabelText('Horário final');
    expect((endTime as HTMLInputElement).value).toBe('12:00');
    fireEvent.change(endTime, { target: { value: '13:00' } });
    await user.click(screen.getByRole('button', { name: 'Salvar disponibilidade' }));

    expect(replaceAvailabilityMock).toHaveBeenCalledWith([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '13:00' },
    ]);
    expect(await screen.findByText('Disponibilidade atualizada.')).toBeTruthy();
  });
});