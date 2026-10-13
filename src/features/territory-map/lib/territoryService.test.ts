import type { Geometry } from 'geojson';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateSubdivisionDrafts,
  loadActiveSubdivisionMemberships,
  loadMyActiveSubdivisionMembership,
  loadVisibleRegionSet,
  publishRegionPartition,
  saveRegionPartition,
  saveSubdivisionEdits,
  setMySubdivisionMembership,
  validateRegionPartition,
} from './territoryService';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

const square: Geometry = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
};

const validationResult = {
  targetRegionCount: 1,
  draftRegionCount: 1,
  expectedAreaSquareMeters: 100,
  draftCountMatchesTarget: true,
  allContained: true,
  allWithinAreaTolerance: true,
  maximumDeviationPercent: 0,
  hasOverlaps: false,
  coverageDifferenceSquareMeters: 0,
  passesValidation: true,
  regions: [],
};

const subdivisionResult = {
  regionSetId: '12345678-1234-4234-8234-123456789abc',
  regionId: '23456789-1234-4234-8234-123456789abc',
  targetSubdivisionCount: 1,
  expectedAreaSquareMeters: 100,
  coverageDifferenceSquareMeters: 0,
  subdivisions: [{
    id: '34567890-1234-4234-8234-123456789abc',
    number: 1,
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    },
    areaSquareMeters: 100,
    deviationPercent: 0,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: validationResult, error: null });
});

describe('validateRegionPartition', () => {
  it('sends draft geometries and target count to the PostGIS validator', async () => {
    await expect(validateRegionPartition([square], 1)).resolves.toEqual(validationResult);

    expect(rpcMock).toHaveBeenCalledWith('validate_region_partition', {
      p_regions: [square],
      p_target_count: 1,
    });
  });

  it('returns a generic error when the database rejects the request', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Internal PostGIS detail' } });

    await expect(validateRegionPartition([square], 1)).rejects.toThrow(
      'Não foi possível validar as regiões no servidor. Tente novamente.',
    );
  });

  it('rejects an unexpected response shape', async () => {
    rpcMock.mockResolvedValueOnce({ data: { passesValidation: 'yes' }, error: null });

    await expect(validateRegionPartition([square], 1)).rejects.toThrow(
      'Não foi possível validar as regiões no servidor. Tente novamente.',
    );
  });
});

describe('saveRegionPartition', () => {
  it('sends validated geometry, target count, and region colors to the draft saver', async () => {
    rpcMock.mockResolvedValueOnce({
      data: '12345678-1234-4234-8234-123456789abc',
      error: null,
    });

    await expect(saveRegionPartition([square], 1, ['#123456'])).resolves.toBe(
      '12345678-1234-4234-8234-123456789abc',
    );
    expect(rpcMock).toHaveBeenCalledWith('save_region_partition', {
      p_regions: [square],
      p_target_count: 1,
      p_colors: ['#123456'],
    });
  });

  it('does not expose database errors from the draft saver', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Internal constraint detail' } });

    await expect(saveRegionPartition([square], 1, ['#123456'])).rejects.toThrow(
      'Não foi possível salvar o rascunho de regiões. Tente novamente.',
    );
  });
});

describe('generateSubdivisionDrafts', () => {
  it('calls the generator for the selected region and parses GeoJSON parts', async () => {
    rpcMock.mockResolvedValueOnce({ data: subdivisionResult, error: null });

    await expect(generateSubdivisionDrafts(subdivisionResult.regionSetId, 1, 1)).resolves.toEqual(subdivisionResult);
    expect(rpcMock).toHaveBeenCalledWith('generate_subdivision_drafts', {
      p_region_set_id: subdivisionResult.regionSetId,
      p_region_number: 1,
      p_target_count: 1,
    });
  });

  it('rejects malformed generation reports with a generic message', async () => {
    rpcMock.mockResolvedValueOnce({ data: { subdivisions: [] }, error: null });

    await expect(generateSubdivisionDrafts(subdivisionResult.regionSetId, 1, 1)).rejects.toThrow(
      'Não foi possível gerar as subdivisões no servidor. Tente novamente.',
    );
  });
});

describe('saveSubdivisionEdits', () => {
  it('sends the selected region and edited numbered geometries to PostGIS', async () => {
    const regionId = '23456789-1234-4234-8234-123456789abc';
    const edits = [{ number: 1, geometry: square }];
    const result = {
      regionId,
      subdivisionCount: 1,
      coverageDifferenceSquareMeters: 0,
      subdivisions: [{ number: 1, areaSquareMeters: 100, deviationPercent: 0 }],
    };
    rpcMock.mockResolvedValueOnce({ data: result, error: null });

    await expect(saveSubdivisionEdits(regionId, edits)).resolves.toEqual(result);
    expect(rpcMock).toHaveBeenCalledWith('save_subdivision_edits', {
      p_region_id: regionId,
      p_subdivisions: edits,
    });
  });

  it('returns a generic error when edited geometry fails PostGIS checks', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Containment SQL detail' } });

    await expect(saveSubdivisionEdits('23456789-1234-4234-8234-123456789abc', [
      { number: 1, geometry: square },
    ])).rejects.toThrow('Não foi possível salvar as alterações das subdivisões. Tente novamente.');
  });
});

describe('publishRegionPartition', () => {
  it('publishes a validated region set and returns its publication time', async () => {
    const regionSetId = '12345678-1234-4234-8234-123456789abc';
    const result = {
      regionSetId,
      regionCount: 1,
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
    };
    rpcMock.mockResolvedValueOnce({ data: result, error: null });

    await expect(publishRegionPartition(regionSetId)).resolves.toEqual(result);
    expect(rpcMock).toHaveBeenCalledWith('publish_region_partition', {
      p_region_set_id: regionSetId,
    });
  });

  it('returns a generic message when PostGIS refuses publication', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Published set already exists' } });

    await expect(publishRegionPartition('12345678-1234-4234-8234-123456789abc')).rejects.toThrow(
      'Não foi possível publicar o mapa. Confira a validação e se já existe um mapa publicado.',
    );
  });

  it('sends an explicit membership mapping when replacing a published map', async () => {
    const regionSetId = '12345678-1234-4234-8234-123456789abc';
    const realignments = [{
      membershipId: '23456789-1234-4234-8234-123456789abc',
      subdivisionId: '34567890-1234-4234-8234-123456789abc',
    }];
    rpcMock.mockResolvedValueOnce({
      data: {
        regionSetId,
        regionCount: 1,
        status: 'published',
        publishedAt: '2026-10-12T12:00:00.000Z',
        realignedMembershipCount: 1,
      },
      error: null,
    });

    await publishRegionPartition(regionSetId, realignments);

    expect(rpcMock).toHaveBeenCalledWith('publish_region_partition', {
      p_region_set_id: regionSetId,
      p_membership_reassignments: realignments,
    });
  });

  it('rejects a replacement report that did not confirm every realignment', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        regionSetId: '12345678-1234-4234-8234-123456789abc',
        regionCount: 1,
        status: 'published',
        publishedAt: '2026-10-12T12:00:00.000Z',
        realignedMembershipCount: 0,
      },
      error: null,
    });

    await expect(publishRegionPartition('12345678-1234-4234-8234-123456789abc', [{
      membershipId: '23456789-1234-4234-8234-123456789abc',
      subdivisionId: '34567890-1234-4234-8234-123456789abc',
    }])).rejects.toThrow('Não foi possível publicar o mapa. Confira a validação e se já existe um mapa publicado.');
  });
});

describe('loadVisibleRegionSet', () => {
  it('returns only the geometry-safe region map report from the RLS-scoped RPC', async () => {
    const regionSet = {
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        color: '#123456',
        geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] },
        subdivisions: [{
          id: '34567890-1234-4234-8234-123456789abc',
          number: 1,
          geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] },
        }],
      }],
    };
    rpcMock.mockResolvedValueOnce({ data: regionSet, error: null });

    await expect(loadVisibleRegionSet()).resolves.toEqual(regionSet);
    expect(rpcMock).toHaveBeenCalledWith('get_visible_region_set');
  });

  it('loads current memberships and area labels for city-leader realignment', async () => {
    const memberships = [{
      id: '45678901-1234-4234-8234-123456789abc',
      participantId: '56789012-1234-4234-8234-123456789abc',
      participantName: 'Pessoa Participante',
      subdivisionId: '67890123-1234-4234-8234-123456789abc',
      regionNumber: 2,
      subdivisionNumber: 4,
    }];
    rpcMock.mockResolvedValueOnce({ data: memberships, error: null });

    await expect(loadActiveSubdivisionMemberships()).resolves.toEqual(memberships);
    expect(rpcMock).toHaveBeenCalledWith('get_active_subdivision_memberships');
  });

  it('returns null when the current user has no visible region set', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(loadVisibleRegionSet()).resolves.toBeNull();
  });
});

describe('participant subdivision membership', () => {
  it('loads the current participant membership from the RLS-scoped RPC', async () => {
    const membership = {
      membershipId: '45678901-1234-4234-8234-123456789abc',
      subdivisionId: '56789012-1234-4234-8234-123456789abc',
      regionNumber: 2,
      subdivisionNumber: 4,
    };
    rpcMock.mockResolvedValueOnce({ data: membership, error: null });

    await expect(loadMyActiveSubdivisionMembership()).resolves.toEqual(membership);
    expect(rpcMock).toHaveBeenCalledWith('get_my_active_subdivision_membership');
  });

  it('returns null when a participant has not selected a subdivision', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(loadMyActiveSubdivisionMembership()).resolves.toBeNull();
  });

  it('sets or switches the participant subdivision through the validated RPC', async () => {
    const subdivisionId = '56789012-1234-4234-8234-123456789abc';
    const result = {
      membershipId: '45678901-1234-4234-8234-123456789abc',
      subdivisionId,
      changed: true,
    };
    rpcMock.mockResolvedValueOnce({ data: result, error: null });

    await expect(setMySubdivisionMembership(subdivisionId)).resolves.toEqual(result);
    expect(rpcMock).toHaveBeenCalledWith('set_my_subdivision_membership', {
      p_subdivision_id: subdivisionId,
    });
  });

  it('rejects malformed membership responses with a generic message', async () => {
    rpcMock.mockResolvedValueOnce({ data: { membershipId: 'not-a-uuid' }, error: null });

    await expect(setMySubdivisionMembership('56789012-1234-4234-8234-123456789abc'))
      .rejects.toThrow('Não foi possível salvar sua inscrição na subdivisão. Tente novamente.');
  });
});