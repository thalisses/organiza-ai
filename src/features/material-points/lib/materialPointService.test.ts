import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteMaterialPoint,
  listMaterialPoints,
  saveMaterialPoint,
  type SaveMaterialPointInput,
} from './materialPointService';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

const pointId = '12345678-1234-4234-8234-123456789abc';
const point = {
  id: pointId,
  name: 'Ponto Central',
  materialType: 'Panfletos',
  topic: 'Mobilização territorial',
  address: 'Praça da Catedral, s/n',
  location: { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] },
  pickupWindows: [{ dayOfWeek: 1 as const, startsAt: '09:00', endsAt: '11:00' }],
};
const input: SaveMaterialPointInput = {
  id: null,
  name: point.name,
  materialType: point.materialType,
  topic: point.topic,
  address: point.address,
  longitude: -51.95,
  latitude: -23.42,
  pickupWindows: point.pickupWindows,
};

beforeEach(() => vi.clearAllMocks());

describe('materialPointService', () => {
  it('loads public material points and recurring pickup windows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [point], error: null });

    await expect(listMaterialPoints()).resolves.toEqual([point]);
    expect(rpcMock).toHaveBeenCalledWith('list_material_points');
  });

  it('saves free-text point details and serializes recurring windows', async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: pointId }, error: null });

    await expect(saveMaterialPoint(input)).resolves.toBe(pointId);
    expect(rpcMock).toHaveBeenCalledWith('save_material_point', {
      p_point_id: null,
      p_name: input.name,
      p_material_type: input.materialType,
      p_topic: input.topic,
      p_address: input.address,
      p_longitude: input.longitude,
      p_latitude: input.latitude,
      p_windows: [{ dayOfWeek: 1, startsAt: '09:00', endsAt: '11:00' }],
    });
  });

  it('rejects overlapping windows before making a database call', async () => {
    await expect(saveMaterialPoint({
      ...input,
      pickupWindows: [
        { dayOfWeek: 1, startsAt: '09:00', endsAt: '11:00' },
        { dayOfWeek: 1, startsAt: '10:30', endsAt: '12:00' },
      ],
    })).rejects.toThrow('Os horários do mesmo dia não podem se sobrepor.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('deletes a point through the authorized database function', async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: pointId, deleted: true }, error: null });

    await expect(deleteMaterialPoint(pointId)).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('delete_material_point', { p_point_id: pointId });
  });
});
