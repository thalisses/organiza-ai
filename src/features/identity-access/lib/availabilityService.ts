import { getSupabaseClient } from '../../../lib/supabase/client';

export interface AvailabilityWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAt: string;
  endsAt: string;
}

interface AvailabilityWindowRecord {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
}

interface SerializedAvailabilityWindow {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
}

export function validateAvailabilityWindows(
  windows: unknown,
): asserts windows is readonly AvailabilityWindow[] {
  if (!Array.isArray(windows) || windows.length === 0) {
    throw new Error('Informe ao menos um intervalo semanal válido.');
  }

  for (const untrustedWindow of windows as unknown[]) {
    if (!untrustedWindow || typeof untrustedWindow !== 'object') {
      throw new Error('Informe um dia da semana válido.');
    }
    const window = untrustedWindow as {
      dayOfWeek?: unknown;
      startsAt?: unknown;
      endsAt?: unknown;
    };
    const dayOfWeek = window.dayOfWeek;
    const startsAt = window.startsAt;
    const endsAt = window.endsAt;

    if (
      typeof dayOfWeek !== 'number'
      || !Number.isInteger(dayOfWeek)
      || dayOfWeek < 0
      || dayOfWeek > 6
    ) {
      throw new Error('Informe um dia da semana válido.');
    }

    if (
      typeof startsAt !== 'string'
      || typeof endsAt !== 'string'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startsAt)
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endsAt)
    ) {
      throw new Error('Informe os horários no formato HH:mm.');
    }

    const startMinutes = toMinutes(startsAt);
    const endMinutes = toMinutes(endsAt);
    if (endMinutes <= startMinutes) {
      throw new Error('Cada intervalo deve terminar depois do horário inicial.');
    }
  }
}

export function serializeAvailabilityWindows(
  windows: readonly AvailabilityWindow[],
): SerializedAvailabilityWindow[] {
  validateAvailabilityWindows(windows);
  return windows.map(({ dayOfWeek, startsAt, endsAt }) => ({
    day_of_week: dayOfWeek,
    starts_at: startsAt,
    ends_at: endsAt,
  }));
}

export async function loadMyAvailability(): Promise<AvailabilityWindow[]> {
  const client = getSupabaseClient();
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from('availability_windows')
    .select('day_of_week, starts_at, ends_at')
    .eq('profile_id', userId)
    .order('day_of_week')
    .order('starts_at');

  if (error || !data) {
    throw new Error('Não foi possível carregar sua disponibilidade. Tente novamente.');
  }

  try {
    const windows = (data as AvailabilityWindowRecord[]).map((record) => ({
      dayOfWeek: record.day_of_week,
      startsAt: record.starts_at.slice(0, 5),
      endsAt: record.ends_at.slice(0, 5),
    })) as AvailabilityWindow[];
    if (windows.length > 0) {
      validateAvailabilityWindows(windows);
    }
    return windows;
  } catch {
    throw new Error('Não foi possível carregar sua disponibilidade. Tente novamente.');
  }
}

export async function replaceMyAvailability(
  windows: readonly AvailabilityWindow[],
): Promise<AvailabilityWindow[]> {
  const serializedWindows = serializeAvailabilityWindows(windows);
  const client = getSupabaseClient();
  const userId = await getCurrentUserId(client);
  const { error } = await client.rpc('replace_my_availability', {
    p_windows: serializedWindows,
  });

  if (error) {
    throw new Error('Não foi possível salvar sua disponibilidade. Tente novamente.');
  }

  return loadMyAvailabilityForUser(client, userId);
}

async function getCurrentUserId(client: ReturnType<typeof getSupabaseClient>): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error('Não foi possível identificar sua conta. Entre novamente.');
  }
  return data.user.id;
}

async function loadMyAvailabilityForUser(
  client: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<AvailabilityWindow[]> {
  const { data, error } = await client
    .from('availability_windows')
    .select('day_of_week, starts_at, ends_at')
    .eq('profile_id', userId)
    .order('day_of_week')
    .order('starts_at');

  if (error || !data) {
    throw new Error('A disponibilidade foi salva, mas não pôde ser recarregada.');
  }

  const windows = (data as AvailabilityWindowRecord[]).map((record) => ({
    dayOfWeek: record.day_of_week,
    startsAt: record.starts_at.slice(0, 5),
    endsAt: record.ends_at.slice(0, 5),
  })) as AvailabilityWindow[];
  if (windows.length > 0) {
    validateAvailabilityWindows(windows);
  }
  return windows;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}