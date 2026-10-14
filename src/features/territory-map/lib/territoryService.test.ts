import type { Geometry } from 'geojson';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateSubdivisionDrafts,
  createManualSubdivision,
  loadMyActiveRegionMemberships,
  loadActiveSubdivisionMemberships,
  loadMyActiveSubdivisionMembership,
  loadVisibleRegionSet,
  previewSubdivisionCuts,
  publishRegionPartition,
  saveRegionPartition,
  saveSubdivisionEdits,
  setMyRegionMemberships,
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

describe('previewSubdivisionCuts', () => {
  const preview = {
    regionId: subdivisionResult.regionId,
    baseToken: 'a'.repeat(32),
    coverageDifferenceSquareMeters: 0,
    cuts: [],
    subdivisions: [{
      ref: 'root', number: 1, geometry: subdivisionResult.subdivisions[0].geometry,
      areaSquareMeters: 100, deviationPercent: 0,
    }],
  };

  it('loads a canonical base without persisting a subdivision', async () => {
    rpcMock.mockResolvedValueOnce({ data: preview, error: null });
    await expect(previewSubdivisionCuts(preview.regionId, null, [])).resolves.toEqual(preview);
    expect(rpcMock).toHaveBeenCalledWith('preview_subdivision_cuts', {
      p_region_id: preview.regionId, p_base_token: null, p_cuts: [],
    });
  });

  it('rejects a response for a different region', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...preview, regionId: subdivisionResult.regionSetId }, error: null });
    await expect(previewSubdivisionCuts(preview.regionId, null, [])).rejects.toThrow('Não foi possível calcular o corte.');
  });

  it('rejects malformed coordinates in a server response', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...preview, subdivisions: [{ ...preview.subdivisions[0], geometry: { type: 'MultiPolygon', coordinates: [[[[0, 'bad']]]] } }] }, error: null });
    await expect(previewSubdivisionCuts(preview.regionId, null, [])).rejects.toThrow('Não foi possível calcular o corte.');
  });

  it('translates a state conflict without exposing SQL details', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'DRAFT_CONFLICT', code: '40001' } });
    await expect(previewSubdivisionCuts(preview.regionId, null, [])).rejects.toThrow('A região mudou. Recarregue a base antes de continuar.');
  });

  it.each([
    ['CUT_ENDPOINTS_OFF_BOUNDARY', 'O início e o fim precisam estar no limite da área selecionada.'],
    ['CUT_OUTSIDE_TARGET', 'O traçado sai da área selecionada. Confira o alvo do corte.'],
    ['CUT_FOLLOWS_BOUNDARY', 'O traçado acompanha a borda. O corte precisa atravessar o interior da área.'],
  ])('explains the specific rejection %s', async (code, message) => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: code } });
    await expect(previewSubdivisionCuts(preview.regionId, null, [])).rejects.toThrow(message);
  });

  it('rejects invalid input before calling the server', async () => {
    await expect(previewSubdivisionCuts('not-a-region', null, [])).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('createManualSubdivision', () => {
  const saved = { ...subdivisionResult.subdivisions[0], regionId: subdivisionResult.regionId };
  const requestId = '45678901-1234-4234-8234-123456789abc';

  it('creates one region-scoped subdivision with a stable request ID', async () => {
    rpcMock.mockResolvedValueOnce({ data: saved, error: null });
    await expect(createManualSubdivision(saved.regionId, square, requestId)).resolves.toEqual(saved);
    expect(rpcMock).toHaveBeenCalledWith('create_manual_subdivision', {
      p_region_id: saved.regionId, p_geometry: square, p_request_id: requestId,
    });
  });

  it('rejects a response for another region', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...saved, regionId: subdivisionResult.regionSetId }, error: null });
    await expect(createManualSubdivision(saved.regionId, square, requestId)).rejects.toThrow('Não foi possível salvar a subregião.');
  });

  it('explains invalid geometry without exposing SQL', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'MANUAL_GEOMETRY_INVALID' } });
    await expect(createManualSubdivision(saved.regionId, square, requestId)).rejects.toThrow('O desenho não forma uma área válida dentro da região selecionada.');
  });

  it('rejects invalid inputs before calling the server', async () => {
    await expect(createManualSubdivision('bad-id', square, requestId)).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
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
  it('accepts valid subdivision numbers with gaps after automatic cleanup', async () => {
    const report = {
      regionSetId: subdivisionResult.regionSetId, status: 'published', publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: subdivisionResult.regionSetId, targetRegionCount: 1, isSystemDefault: false,
      regions: [{ id: subdivisionResult.regionId, number: 1, name: null, color: '#123456',
        geometry: subdivisionResult.subdivisions[0].geometry,
        subdivisions: [{ ...subdivisionResult.subdivisions[0], number: 7 }],
      }],
    };
    rpcMock.mockResolvedValueOnce({data:{initialized:false},error:null}).mockResolvedValueOnce({data:report,error:null});
    await expect(loadVisibleRegionSet()).resolves.toEqual(report);
  });

  it('ensures Maringá defaults exist before loading the visible map', async () => {
    const regionSet = {
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      isSystemDefault: true,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        name: 'GT Unicesumar e região',
        color: '#123456',
        geometry: { type: 'MultiPolygon', coordinates: [] },
        subdivisions: [],
      }],
    };
    rpcMock
      .mockResolvedValueOnce({ data: { initialized: false }, error: null })
      .mockResolvedValueOnce({ data: regionSet, error: null });

    await expect(loadVisibleRegionSet()).resolves.toEqual(regionSet);

    expect(rpcMock.mock.calls).toEqual([
      ['ensure_maringa_default_regions'],
      ['get_visible_region_set'],
    ]);
  });

  it('does not load the visible map when default initialization fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Internal database error' } });

    await expect(loadVisibleRegionSet()).rejects.toThrow(
      'Não foi possível carregar o mapa de regiões. Tente novamente.',
    );
    expect(rpcMock.mock.calls).toEqual([['ensure_maringa_default_regions']]);
  });

  it('returns only the geometry-safe region map report from the RLS-scoped RPC', async () => {
    const regionSet = {
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      isSystemDefault: false,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        name: null,
        color: '#123456',
        geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] },
        subdivisions: [{
          id: '34567890-1234-4234-8234-123456789abc',
          number: 1,
          geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] },
        }],
      }],
    };
    rpcMock
      .mockResolvedValueOnce({ data: { initialized: false }, error: null })
      .mockResolvedValueOnce({ data: regionSet, error: null });

    await expect(loadVisibleRegionSet()).resolves.toEqual(regionSet);
    expect(rpcMock.mock.calls).toEqual([
      ['ensure_maringa_default_regions'],
      ['get_visible_region_set'],
    ]);
  });

  it('rejects visible map responses without initialization metadata', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { initialized: false }, error: null })
      .mockResolvedValueOnce({
        data: {
          regionSetId: '12345678-1234-4234-8234-123456789abc',
          status: 'published',
          publishedAt: '2026-10-12T12:00:00.000Z',
          publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
          targetRegionCount: 1,
          regions: [{
            id: '23456789-1234-4234-8234-123456789abc',
            number: 1,
            color: '#123456',
            geometry: { type: 'MultiPolygon', coordinates: [] },
            subdivisions: [],
          }],
        },
        error: null,
      });

    await expect(loadVisibleRegionSet()).rejects.toThrow(
      'Não foi possível carregar o mapa de regiões. Tente novamente.',
    );
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
    rpcMock
      .mockResolvedValueOnce({ data: { initialized: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

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

describe('participant map division memberships', () => {
  it('loads all active map divisions through the participant-scoped RPC', async () => {
    const regionIds = [
      '56789012-1234-4234-8234-123456789abc',
      '67890123-1234-4234-8234-123456789abc',
    ];
    rpcMock.mockResolvedValueOnce({ data: regionIds, error: null });

    await expect(loadMyActiveRegionMemberships()).resolves.toEqual(regionIds);
    expect(rpcMock).toHaveBeenCalledWith('get_my_active_region_memberships');
  });

  it('saves multiple map division choices through one validated RPC', async () => {
    const regionIds = [
      '56789012-1234-4234-8234-123456789abc',
      '67890123-1234-4234-8234-123456789abc',
    ];
    rpcMock.mockResolvedValueOnce({ data: regionIds, error: null });

    await expect(setMyRegionMemberships(regionIds)).resolves.toEqual(regionIds);
    expect(rpcMock).toHaveBeenCalledWith('set_my_region_memberships', {
      p_region_ids: regionIds,
    });
  });

  it('rejects duplicate map division choices before calling the RPC', async () => {
    const regionId = '56789012-1234-4234-8234-123456789abc';

    await expect(setMyRegionMemberships([regionId, regionId]))
      .rejects.toThrow('Não foi possível salvar suas inscrições nas divisões. Tente novamente.');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});