import { getSupabaseClient } from '../../../lib/supabase/client';

export type UserRole = 'participante' | 'lider_setor' | 'lider_cidade';
export type SectorLeaderCandidateRole = 'participante' | 'lider_setor';

export interface SectorLeaderCandidate {
  id: string;
  name: string;
  role: SectorLeaderCandidateRole;
}

export interface SectorLeaderDirectory {
  isCityLeader: boolean;
  candidates: SectorLeaderCandidate[];
}

interface CurrentProfile {
  client: ReturnType<typeof getSupabaseClient>;
  role: UserRole;
}

const PILOT_CITY_ID = '41152000-0000-4000-8000-000000000001';

export async function loadCurrentUserRole(): Promise<UserRole> {
  const { role } = await getCurrentProfile();
  return role;
}

export async function loadSectorLeaderCandidates(): Promise<SectorLeaderDirectory> {
  const { client, role } = await getCurrentProfile();
  if (role !== 'lider_cidade') {
    return { isCityLeader: false, candidates: [] };
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, name, role')
    .eq('city_id', PILOT_CITY_ID)
    .in('role', ['participante', 'lider_setor'])
    .order('name');

  if (error || !data) {
    throw new Error('Não foi possível carregar a equipe da cidade. Tente novamente.');
  }

  return {
    isCityLeader: true,
    candidates: parseCandidates(data),
  };
}

export async function setSectorLeader(
  profileId: string,
  isSectorLeader: boolean,
): Promise<void> {
  const { client, role } = await getCurrentProfile();
  if (role !== 'lider_cidade') {
    throw new Error('Somente a liderança da cidade pode gerenciar líderes de setor.');
  }

  const { error } = await client.rpc('set_sector_leader', {
    p_profile_id: profileId,
    p_is_sector_leader: isSectorLeader,
  });

  if (error) {
    throw new Error('Não foi possível atualizar a liderança de setor. Tente novamente.');
  }
}

async function getCurrentProfile(): Promise<CurrentProfile> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Não foi possível identificar sua conta. Entre novamente.');
  }

  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error || !data || !isUserRole(data.role)) {
    throw new Error('Não foi possível verificar seu papel na cidade. Tente novamente.');
  }

  return { client, role: data.role };
}

function parseCandidates(data: unknown): SectorLeaderCandidate[] {
  if (!Array.isArray(data)) {
    throw new Error('Não foi possível carregar a equipe da cidade. Tente novamente.');
  }

  return data.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Não foi possível carregar a equipe da cidade. Tente novamente.');
    }

    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || (candidate.role !== 'participante' && candidate.role !== 'lider_setor')
    ) {
      throw new Error('Não foi possível carregar a equipe da cidade. Tente novamente.');
    }

    return {
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
    };
  });
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'participante' || value === 'lider_setor' || value === 'lider_cidade';
}