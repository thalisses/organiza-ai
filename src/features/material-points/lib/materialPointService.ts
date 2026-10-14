import type { Point } from 'geojson';
import { getSupabaseClient } from '../../../lib/supabase/client';

export interface PickupWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAt: string;
  endsAt: string;
}

export interface MaterialPoint {
  id: string;
  name: string;
  materialType: string;
  topic: string;
  address: string;
  location: Point;
  pickupWindows: PickupWindow[];
}

export interface SaveMaterialPointInput {
  id: string | null;
  name: string;
  materialType: string;
  topic: string;
  address: string;
  longitude: number;
  latitude: number;
  pickupWindows: PickupWindow[];
}

const listErrorMessage = 'Não foi possível carregar os pontos de material. Tente novamente.';
const saveErrorMessage = 'Não foi possível salvar o ponto. Verifique os dados e suas permissões.';
const deleteErrorMessage = 'Não foi possível excluir o ponto. Tente novamente.';

export async function listMaterialPoints(): Promise<MaterialPoint[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('list_material_points');
    if (error || !Array.isArray(data) || !data.every(isMaterialPoint)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(listErrorMessage);
  }
}

export async function saveMaterialPoint(input: SaveMaterialPointInput): Promise<string> {
  try {
    validateSaveInput(input);
    const { data, error } = await getSupabaseClient().rpc('save_material_point', {
      p_point_id: input.id,
      p_name: input.name.trim(),
      p_material_type: input.materialType.trim(),
      p_topic: input.topic.trim(),
      p_address: input.address.trim(),
      p_longitude: input.longitude,
      p_latitude: input.latitude,
      p_windows: input.pickupWindows.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      })),
    });
    if (error || !isUuid(data?.id)) {
      throw new Error();
    }
    return data.id;
  } catch (error) {
    if (error instanceof Error && error.message === 'Os horários do mesmo dia não podem se sobrepor.') {
      throw error;
    }
    throw new Error(saveErrorMessage, { cause: error });
  }
}

export async function deleteMaterialPoint(pointId: string): Promise<void> {
  try {
    if (!isUuid(pointId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('delete_material_point', {
      p_point_id: pointId,
    });
    if (error || data?.id !== pointId || data.deleted !== true) {
      throw new Error();
    }
  } catch {
    throw new Error(deleteErrorMessage);
  }
}

function validateSaveInput(input: SaveMaterialPointInput): void {
  if (input.id !== null && !isUuid(input.id)) {
    throw new Error(saveErrorMessage);
  }
  if (
    input.name.trim().length < 2 || input.name.trim().length > 120
    || input.materialType.trim().length < 2 || input.materialType.trim().length > 120
    || input.topic.trim().length < 2 || input.topic.trim().length > 160
    || input.address.trim().length < 3 || input.address.trim().length > 240
    || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180
    || !Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90
  ) {
    throw new Error(saveErrorMessage);
  }
  validatePickupWindows(input.pickupWindows);
}

function validatePickupWindows(value: unknown): asserts value is PickupWindow[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error(saveErrorMessage);
  }

  const windows = value as unknown[];
  for (const entry of windows) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(saveErrorMessage);
    }
    const window = entry as Record<string, unknown>;
    if (
      typeof window.dayOfWeek !== 'number'
      || !Number.isInteger(window.dayOfWeek)
      || window.dayOfWeek < 0
      || window.dayOfWeek > 6
      || typeof window.startsAt !== 'string'
      || typeof window.endsAt !== 'string'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.startsAt)
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.endsAt)
      || window.endsAt <= window.startsAt
    ) {
      throw new Error(saveErrorMessage);
    }
  }

  for (let firstIndex = 0; firstIndex < windows.length; firstIndex += 1) {
    const first = windows[firstIndex] as PickupWindow;
    for (let secondIndex = firstIndex + 1; secondIndex < windows.length; secondIndex += 1) {
      const second = windows[secondIndex] as PickupWindow;
      if (
        first.dayOfWeek === second.dayOfWeek
        && first.startsAt < second.endsAt
        && second.startsAt < first.endsAt
      ) {
        throw new Error('Os horários do mesmo dia não podem se sobrepor.');
      }
    }
  }
}

function isMaterialPoint(value: unknown): value is MaterialPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const point = value as Record<string, unknown>;
  const location = point.location as Record<string, unknown> | null;
  const coordinates = location?.coordinates;
  return typeof point.id === 'string'
    && isUuid(point.id)
    && typeof point.name === 'string'
    && point.name.trim().length > 0
    && typeof point.materialType === 'string'
    && point.materialType.trim().length > 0
    && typeof point.topic === 'string'
    && point.topic.trim().length > 0
    && typeof point.address === 'string'
    && point.address.trim().length > 0
    && Boolean(location)
    && location?.type === 'Point'
    && Array.isArray(coordinates)
    && coordinates.length === 2
    && coordinates.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    && Array.isArray(point.pickupWindows)
    && point.pickupWindows.every(isPickupWindow);
}

function isPickupWindow(value: unknown): value is PickupWindow {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const window = value as Record<string, unknown>;
  return typeof window.dayOfWeek === 'number'
    && Number.isInteger(window.dayOfWeek)
    && window.dayOfWeek >= 0
    && window.dayOfWeek <= 6
    && typeof window.startsAt === 'string'
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.startsAt)
    && typeof window.endsAt === 'string'
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.endsAt)
    && window.endsAt > window.startsAt;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
