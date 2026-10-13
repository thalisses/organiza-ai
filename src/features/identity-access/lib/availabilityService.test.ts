import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadMyAvailability,
  replaceMyAvailability,
  validateAvailabilityWindows,
} from './availabilityService';

const { authGetUserMock, fromMock, query, rpcMock } = vi.hoisted(() => {
  const queryObject = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };

  return {
    authGetUserMock: vi.fn(),
    fromMock: vi.fn(() => queryObject),
    query: queryObject,
    rpcMock: vi.fn(),
  };
});

vi.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: authGetUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'participant-1' } },
    error: null,
  });
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
});

describe('validateAvailabilityWindows', () => {
  it('accepts multiple intervals on the same weekday', () => {
    expect(() => validateAvailabilityWindows([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
      { dayOfWeek: 1, startsAt: '14:00', endsAt: '18:00' },
    ])).not.toThrow();
  });

  it('requires at least one interval', () => {
    expect(() => validateAvailabilityWindows([])).toThrow(
      'Informe ao menos um intervalo semanal válido.',
    );
  });

  it('rejects an invalid weekday', () => {
    expect(() => validateAvailabilityWindows([
      { dayOfWeek: 7, startsAt: '09:00', endsAt: '12:00' },
    ])).toThrow('Informe um dia da semana válido.');
  });

  it('rejects malformed 24-hour times', () => {
    expect(() => validateAvailabilityWindows([
      { dayOfWeek: 1, startsAt: '9:00', endsAt: '12:00' },
    ])).toThrow('Informe os horários no formato HH:mm.');
  });

  it('requires the end time to be later than the start time', () => {
    expect(() => validateAvailabilityWindows([
      { dayOfWeek: 1, startsAt: '12:00', endsAt: '12:00' },
    ])).toThrow('Cada intervalo deve terminar depois do horário inicial.');
  });

  it('loads only the authenticated user schedule and converts database times', async () => {
    query.order
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce({
        data: [{ day_of_week: 1, starts_at: '09:00:00', ends_at: '12:00:00' }],
        error: null,
      });

    await expect(loadMyAvailability()).resolves.toEqual([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
    ]);
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'participant-1');
  });

  it('replaces the authenticated user schedule with serialized weekly windows', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    query.order
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce({
        data: [
          { day_of_week: 1, starts_at: '09:00:00', ends_at: '12:00:00' },
          { day_of_week: 1, starts_at: '14:00:00', ends_at: '18:00:00' },
        ],
        error: null,
      });

    await expect(replaceMyAvailability([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
      { dayOfWeek: 1, startsAt: '14:00', endsAt: '18:00' },
    ])).resolves.toEqual([
      { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
      { dayOfWeek: 1, startsAt: '14:00', endsAt: '18:00' },
    ]);

    expect(rpcMock).toHaveBeenCalledWith('replace_my_availability', {
      p_windows: [
        { day_of_week: 1, starts_at: '09:00', ends_at: '12:00' },
        { day_of_week: 1, starts_at: '14:00', ends_at: '18:00' },
      ],
    });
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'participant-1');
  });
});