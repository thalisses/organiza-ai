import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAct,
  cancelMyActRegistration,
  getActAttendees,
  listMyActiveActIds,
  listActs,
  listManageableActSubdivisions,
  registerForAct,
  saveAct,
  type SaveActInput,
} from './actService';

const { fromMock, isMock, rpcMock, selectMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  isMock: vi.fn(),
  rpcMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

const actId = '12345678-1234-4234-8234-123456789abc';
const subdivisionId = '23456789-1234-4234-8234-123456789abc';
const point = { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] };
const act = {
  id: actId,
  title: 'Panfletagem Centro',
  category: 'leaflet_distribution',
  otherDetail: null,
  startsAt: '2026-10-20T21:00:00.000Z',
  meetingLocation: point,
  meetingAddress: 'Praça da Catedral',
  subdivisionId,
  scope: 'subdivision',
  status: 'scheduled',
};
const input: SaveActInput = {
  id: null,
  title: act.title,
  category: 'leaflet_distribution',
  otherDetail: null,
  startsAt: act.startsAt,
  longitude: -51.95,
  latitude: -23.42,
  meetingAddress: act.meetingAddress,
  subdivisionId,
};

beforeEach(() => {
  vi.clearAllMocks();
  fromMock.mockReturnValue({ select: selectMock });
  selectMock.mockReturnValue({ is: isMock });
});

describe('actService', () => {
  it('loads public city acts from the RLS-scoped RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: [act], error: null });

    await expect(listActs()).resolves.toEqual([act]);
    expect(rpcMock).toHaveBeenCalledWith('list_acts');
  });

  it('loads only subdivisions the current leadership can manage', async () => {
    const subdivisions = [{ id: subdivisionId, regionNumber: 2, subdivisionNumber: 4 }];
    rpcMock.mockResolvedValueOnce({ data: subdivisions, error: null });

    await expect(listManageableActSubdivisions()).resolves.toEqual(subdivisions);
    expect(rpcMock).toHaveBeenCalledWith('list_manageable_act_subdivisions');
  });

  it('creates or updates an act through the validated database function', async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: actId }, error: null });

    await expect(saveAct(input)).resolves.toBe(actId);
    expect(rpcMock).toHaveBeenCalledWith('save_act', {
      p_act_id: null,
      p_title: input.title,
      p_category: input.category,
      p_other_detail: null,
      p_starts_at: input.startsAt,
      p_longitude: input.longitude,
      p_latitude: input.latitude,
      p_meeting_address: input.meetingAddress,
      p_subdivision_id: subdivisionId,
    });
  });

  it('cancels an act without exposing database details', async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: actId, status: 'cancelled' }, error: null });

    await expect(cancelAct(actId)).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('cancel_act', { p_act_id: actId });
  });

  it('rejects malformed act data returned by PostgREST', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ ...act, meetingLocation: 'bad-geometry' }], error: null });

    await expect(listActs()).rejects.toThrow('Não foi possível carregar os atos. Tente novamente.');
  });

  it('loads only the current participant active registration act IDs', async () => {
    isMock.mockResolvedValueOnce({
      data: [{ act_id: actId }, { act_id: '34567890-1234-4234-8234-123456789abc' }],
      error: null,
    });

    await expect(listMyActiveActIds()).resolves.toEqual([
      actId,
      '34567890-1234-4234-8234-123456789abc',
    ]);
    expect(fromMock).toHaveBeenCalledWith('act_registrations');
    expect(selectMock).toHaveBeenCalledWith('act_id');
    expect(isMock).toHaveBeenCalledWith('cancelled_at', null);
  });

  it('registers the current participant in an act through the database RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { registrationId: '45678901-1234-4234-8234-123456789abc', actId, status: 'registered', changed: true },
      error: null,
    });

    await expect(registerForAct(actId)).resolves.toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('register_for_act', { p_act_id: actId });
  });

  it('cancels the current participant registration through the database RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { registrationId: '45678901-1234-4234-8234-123456789abc', actId, status: 'cancelled' },
      error: null,
    });

    await expect(cancelMyActRegistration(actId)).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('cancel_my_act_registration', { p_act_id: actId });
  });

  it('loads attendee contacts only through the leadership-authorized roster RPC', async () => {
    const attendees = [{
      registrationId: '45678901-1234-4234-8234-123456789abc',
      participantName: 'Pessoa Inscrita',
      whatsappE164: '+5511999991234',
      registeredAt: '2026-10-13T12:00:00.000Z',
    }];
    rpcMock.mockResolvedValueOnce({ data: attendees, error: null });

    await expect(getActAttendees(actId)).resolves.toEqual(attendees);
    expect(rpcMock).toHaveBeenCalledWith('get_act_attendees', { p_act_id: actId });
  });

  it('returns a generic error when roster access is denied', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'RLS policy detail' } });

    await expect(getActAttendees(actId)).rejects.toThrow(
      'Não foi possível carregar os inscritos deste ato. Verifique suas permissões.',
    );
  });
});
