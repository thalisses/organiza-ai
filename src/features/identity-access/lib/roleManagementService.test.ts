import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadCurrentUserRole,
  loadSectorLeaderCandidates,
  setSectorLeader,
} from './roleManagementService';

const { authGetUserMock, candidateQuery, fromMock, profileQuery, rpcMock } = vi.hoisted(() => {
  const makeQuery = () => ({
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  });

  return {
    authGetUserMock: vi.fn(),
    candidateQuery: makeQuery(),
    fromMock: vi.fn(),
    profileQuery: makeQuery(),
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
  vi.resetAllMocks();
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'city-leader-1' } },
    error: null,
  });
  fromMock.mockReturnValueOnce(profileQuery);
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  profileQuery.maybeSingle.mockResolvedValue({ data: { role: 'lider_cidade' }, error: null });
  fromMock.mockReturnValueOnce(candidateQuery);
  candidateQuery.select.mockReturnValue(candidateQuery);
  candidateQuery.eq.mockReturnValue(candidateQuery);
  candidateQuery.in.mockReturnValue(candidateQuery);
  candidateQuery.order.mockResolvedValue({
    data: [{ id: 'participant-1', name: 'Participante Um', role: 'participante' }],
    error: null,
  });
  rpcMock.mockResolvedValue({ data: 'lider_setor', error: null });
});

describe('loadSectorLeaderCandidates', () => {
  it('returns participant and sector leader profiles for a city leader', async () => {
    await expect(loadSectorLeaderCandidates()).resolves.toEqual({
      isCityLeader: true,
      candidates: [{ id: 'participant-1', name: 'Participante Um', role: 'participante' }],
    });

    expect(candidateQuery.select).toHaveBeenCalledWith('id, name, role');
    expect(candidateQuery.in).toHaveBeenCalledWith('role', ['participante', 'lider_setor']);
  });

  it('does not load the city directory for a sector leader', async () => {
    profileQuery.maybeSingle.mockResolvedValueOnce({
      data: { role: 'lider_setor' },
      error: null,
    });

    await expect(loadSectorLeaderCandidates()).resolves.toEqual({
      isCityLeader: false,
      candidates: [],
    });
    expect(fromMock).toHaveBeenCalledOnce();
  });
});

describe('loadCurrentUserRole', () => {
  it('returns the authenticated profile role without loading the directory', async () => {
    await expect(loadCurrentUserRole()).resolves.toBe('lider_cidade');
    expect(profileQuery.select).toHaveBeenCalledWith('role');
    expect(fromMock).toHaveBeenCalledOnce();
  });

  it('rejects an unknown profile role', async () => {
    profileQuery.maybeSingle.mockResolvedValueOnce({
      data: { role: 'admin' },
      error: null,
    });

    await expect(loadCurrentUserRole()).rejects.toThrow(
      'Não foi possível verificar seu papel na cidade. Tente novamente.',
    );
  });
});

describe('setSectorLeader', () => {
  it('sends the narrow assignment action to the database function', async () => {
    await setSectorLeader('participant-1', true);

    expect(rpcMock).toHaveBeenCalledWith('set_sector_leader', {
      p_profile_id: 'participant-1',
      p_is_sector_leader: true,
    });
  });

  it('rejects a sector leader before calling the database function', async () => {
    profileQuery.maybeSingle.mockResolvedValueOnce({
      data: { role: 'lider_setor' },
      error: null,
    });

    await expect(setSectorLeader('participant-1', true)).rejects.toThrow(
      'Somente a liderança da cidade pode gerenciar líderes de setor.',
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });
});