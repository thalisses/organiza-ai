import type { Point } from 'geojson';
import { getSupabaseClient } from '../../../lib/supabase/client';

export type ActCategory =
  | 'leaflet_distribution'
  | 'poster_pasting'
  | 'meeting'
  | 'public_rally'
  | 'training'
  | 'other';

export type ActStatus = 'scheduled' | 'cancelled';

export const actCategoryLabels: Record<ActCategory, string> = {
  leaflet_distribution: 'Panfletagem',
  poster_pasting: 'Colagem de lambe-lambe',
  meeting: 'Reunião/assembleia',
  public_rally: 'Ato público',
  training: 'Formação/oficina',
  other: 'Outro',
};

export interface Act {
  id: string;
  title: string;
  category: ActCategory;
  otherDetail: string | null;
  startsAt: string;
  meetingLocation: Point;
  meetingAddress: string;
  subdivisionId: string | null;
  scope: 'city' | 'subdivision';
  status: ActStatus;
}

export interface ManageableActSubdivision {
  id: string;
  regionNumber: number;
  subdivisionNumber: number;
}

export interface ActAttendee {
  registrationId: string;
  participantName: string;
  whatsappE164: string;
  registeredAt: string;
}

export interface SaveActInput {
  id: string | null;
  title: string;
  category: ActCategory;
  otherDetail: string | null;
  startsAt: string;
  longitude: number;
  latitude: number;
  meetingAddress: string;
  subdivisionId: string | null;
}

const loadActsErrorMessage = 'Não foi possível carregar os atos. Tente novamente.';
const loadSubdivisionsErrorMessage = 'Não foi possível carregar as subdivisões disponíveis. Tente novamente.';
const saveActErrorMessage = 'Não foi possível salvar o ato. Verifique os dados e suas permissões.';
const cancelActErrorMessage = 'Não foi possível cancelar o ato. Tente novamente.';
const loadRegistrationErrorMessage = 'Não foi possível carregar suas inscrições. Tente novamente.';
const registerActErrorMessage = 'Não foi possível se inscrever neste ato. Tente novamente.';
const cancelRegistrationErrorMessage = 'Não foi possível cancelar sua inscrição. Tente novamente.';
const loadAttendeesErrorMessage = 'Não foi possível carregar os inscritos deste ato. Verifique suas permissões.';

const actCategories = new Set<ActCategory>([
  'leaflet_distribution',
  'poster_pasting',
  'meeting',
  'public_rally',
  'training',
  'other',
]);

export async function listActs(): Promise<Act[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('list_acts');
    if (error || !Array.isArray(data) || !data.every(isAct)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(loadActsErrorMessage);
  }
}

export async function listManageableActSubdivisions(): Promise<ManageableActSubdivision[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('list_manageable_act_subdivisions');
    if (error || !Array.isArray(data) || !data.every(isManageableActSubdivision)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(loadSubdivisionsErrorMessage);
  }
}

export async function saveAct(input: SaveActInput): Promise<string> {
  try {
    if (!isValidSaveActInput(input)) {
      throw new Error();
    }

    const { data, error } = await getSupabaseClient().rpc('save_act', {
      p_act_id: input.id,
      p_title: input.title,
      p_category: input.category,
      p_other_detail: input.otherDetail,
      p_starts_at: input.startsAt,
      p_longitude: input.longitude,
      p_latitude: input.latitude,
      p_meeting_address: input.meetingAddress,
      p_subdivision_id: input.subdivisionId,
    });

    if (error || !data || typeof data !== 'object' || typeof data.id !== 'string' || !isUuid(data.id)) {
      throw new Error();
    }
    return data.id;
  } catch {
    throw new Error(saveActErrorMessage);
  }
}

export async function cancelAct(actId: string): Promise<void> {
  try {
    if (!isUuid(actId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('cancel_act', { p_act_id: actId });
    if (
      error
      || !data
      || typeof data !== 'object'
      || data.id !== actId
      || data.status !== 'cancelled'
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(cancelActErrorMessage);
  }
}

export async function listMyActiveActIds(): Promise<string[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('act_registrations')
      .select('act_id')
      .is('cancelled_at', null);
    if (error || !Array.isArray(data)) {
      throw new Error();
    }
    return data.map((row) => {
      const actId = (row as Record<string, unknown>).act_id;
      if (typeof actId !== 'string' || !isUuid(actId)) {
        throw new Error();
      }
      return actId;
    });
  } catch {
    throw new Error(loadRegistrationErrorMessage);
  }
}

export async function registerForAct(actId: string): Promise<boolean> {
  try {
    if (!isUuid(actId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('register_for_act', { p_act_id: actId });
    if (
      error
      || !data
      || typeof data !== 'object'
      || typeof data.registrationId !== 'string'
      || !isUuid(data.registrationId)
      || data.actId !== actId
      || data.status !== 'registered'
      || typeof data.changed !== 'boolean'
    ) {
      throw new Error();
    }
    return data.changed;
  } catch {
    throw new Error(registerActErrorMessage);
  }
}

export async function cancelMyActRegistration(actId: string): Promise<void> {
  try {
    if (!isUuid(actId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('cancel_my_act_registration', {
      p_act_id: actId,
    });
    if (
      error
      || !data
      || typeof data !== 'object'
      || typeof data.registrationId !== 'string'
      || !isUuid(data.registrationId)
      || data.actId !== actId
      || data.status !== 'cancelled'
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(cancelRegistrationErrorMessage);
  }
}

export async function getActAttendees(actId: string): Promise<ActAttendee[]> {
  try {
    if (!isUuid(actId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('get_act_attendees', {
      p_act_id: actId,
    });
    if (error || !Array.isArray(data) || !data.every(isActAttendee)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(loadAttendeesErrorMessage);
  }
}

function isAct(value: unknown): value is Act {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const act = value as Record<string, unknown>;
  const location = act.meetingLocation as Record<string, unknown> | null;
  const coordinates = location?.coordinates;
  return typeof act.id === 'string'
    && isUuid(act.id)
    && typeof act.title === 'string'
    && act.title.trim().length > 0
    && typeof act.category === 'string'
    && actCategories.has(act.category as ActCategory)
    && (typeof act.otherDetail === 'string' || act.otherDetail === null)
    && typeof act.startsAt === 'string'
    && Boolean(location)
    && location?.type === 'Point'
    && Array.isArray(coordinates)
    && coordinates.length === 2
    && coordinates.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    && typeof act.meetingAddress === 'string'
    && (typeof act.subdivisionId === 'string' ? isUuid(act.subdivisionId) : act.subdivisionId === null)
    && (act.scope === 'city' || act.scope === 'subdivision')
    && act.scope === (act.subdivisionId === null ? 'city' : 'subdivision')
    && (act.status === 'scheduled' || act.status === 'cancelled');
}

function isManageableActSubdivision(value: unknown): value is ManageableActSubdivision {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const subdivision = value as Record<string, unknown>;
  return typeof subdivision.id === 'string'
    && isUuid(subdivision.id)
    && typeof subdivision.regionNumber === 'number'
    && Number.isInteger(subdivision.regionNumber)
    && typeof subdivision.subdivisionNumber === 'number'
    && Number.isInteger(subdivision.subdivisionNumber);
}

function isActAttendee(value: unknown): value is ActAttendee {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const attendee = value as Record<string, unknown>;
  return typeof attendee.registrationId === 'string'
    && isUuid(attendee.registrationId)
    && typeof attendee.participantName === 'string'
    && attendee.participantName.trim().length > 0
    && typeof attendee.whatsappE164 === 'string'
    && /^\+[1-9][0-9]{7,14}$/.test(attendee.whatsappE164)
    && typeof attendee.registeredAt === 'string'
    && Number.isFinite(Date.parse(attendee.registeredAt));
}

function isValidSaveActInput(input: SaveActInput): boolean {
  return (input.id === null || isUuid(input.id))
    && input.title.trim().length >= 3
    && input.title.trim().length <= 120
    && actCategories.has(input.category)
    && (input.category === 'other'
      ? Boolean(input.otherDetail && input.otherDetail.trim().length >= 2 && input.otherDetail.trim().length <= 80)
      : input.otherDetail === null)
    && Number.isFinite(Date.parse(input.startsAt))
    && Number.isFinite(input.longitude)
    && input.longitude >= -180
    && input.longitude <= 180
    && Number.isFinite(input.latitude)
    && input.latitude >= -90
    && input.latitude <= 90
    && input.meetingAddress.trim().length >= 3
    && input.meetingAddress.trim().length <= 240
    && (input.subdivisionId === null || isUuid(input.subdivisionId));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
