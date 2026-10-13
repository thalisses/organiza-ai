import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Geometry } from 'geojson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CityMap from './CityMap';

const {
  addControlsMock,
  fetchMock,
  fitBoundsMock,
  loadActiveMembershipsMock,
  loadMyMembershipMock,
  loadRoleMock,
  loadVisibleRegionSetMock,
  mapOffMock,
  mapOnMock,
  publishRegionPartitionMock,
  removeControlsMock,
  saveRegionPartitionMock,
  saveSubdivisionEditsMock,
  setMyMembershipMock,
  subdivisionLayerDisableMock,
  subdivisionLayerEnableMock,
  subdivisionLayerOnMock,
  generateSubdivisionDraftsMock,
  setGlobalOptionsMock,
  validateRegionPartitionMock,
} = vi.hoisted(() => ({
  addControlsMock: vi.fn(),
  fetchMock: vi.fn(),
  fitBoundsMock: vi.fn(),
  loadActiveMembershipsMock: vi.fn(),
  loadMyMembershipMock: vi.fn(),
  loadRoleMock: vi.fn(),
  loadVisibleRegionSetMock: vi.fn(),
  mapOffMock: vi.fn(),
  mapOnMock: vi.fn(),
  publishRegionPartitionMock: vi.fn(),
  removeControlsMock: vi.fn(),
  saveRegionPartitionMock: vi.fn(),
  saveSubdivisionEditsMock: vi.fn(),
  setMyMembershipMock: vi.fn(),
  subdivisionLayerDisableMock: vi.fn(),
  subdivisionLayerEnableMock: vi.fn(),
  subdivisionLayerOnMock: vi.fn(),
  generateSubdivisionDraftsMock: vi.fn(),
  setGlobalOptionsMock: vi.fn(),
  validateRegionPartitionMock: vi.fn(),
}));

interface MockMapContainerProps {
  children: ReactNode;
}

interface MockTileLayerProps {
  url: string;
  attribution: string;
}

interface MockGeoJSONProps {
  data: {
    features: Array<{
      properties?: { area?: string; region_number?: number; subdivision_number?: number };
      geometry?: Geometry;
    }>;
  };
  onEachFeature?: (
    feature: { properties?: { area?: string; region_number?: number; subdivision_number?: number }; geometry?: Geometry },
    layer: {
      bindTooltip: (
        content: string,
        options: { permanent: boolean; direction: 'center'; className: string },
      ) => void;
      pm: { disable: typeof subdivisionLayerDisableMock; enable: typeof subdivisionLayerEnableMock };
      on: typeof subdivisionLayerOnMock;
      toGeoJSON: () => { geometry: Geometry | undefined };
    },
  ) => void;
}

vi.mock('react-leaflet', () => ({
  GeoJSON: ({ data, onEachFeature }: MockGeoJSONProps) => {
    const isSubdivisionLayer = data.features.some((feature) => feature.properties?.subdivision_number !== undefined);
    const isPublishedRegionLayer = data.features.some((feature) => feature.properties?.region_number !== undefined);
    if (isSubdivisionLayer) {
      data.features.forEach((feature) => onEachFeature?.(feature, {
        pm: { disable: subdivisionLayerDisableMock, enable: subdivisionLayerEnableMock },
        on: subdivisionLayerOnMock,
        bindTooltip: vi.fn(),
        toGeoJSON: () => ({ geometry: feature.geometry }),
      }));
    }
    return (
      <output
        data-areas={data.features.map((feature) => feature.properties?.area).join('|')}
        data-testid={isSubdivisionLayer
          ? 'subdivision-feature-count'
          : isPublishedRegionLayer
            ? 'published-region-count'
            : 'boundary-feature-count'}
      >
        {data.features.length}
      </output>
    );
  },
  MapContainer: ({ children }: MockMapContainerProps) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  useMap: () => ({
    fitBounds: fitBoundsMock,
    on: mapOnMock,
    off: mapOffMock,
    pm: {
      addControls: addControlsMock,
      removeControls: removeControlsMock,
      setGlobalOptions: setGlobalOptionsMock,
    },
  }),
  TileLayer: ({ url, attribution }: MockTileLayerProps) => (
    <output data-attribution={attribution} data-testid="map-tiles" data-url={url} />
  ),
}));

vi.mock('../../identity-access/lib/roleManagementService', () => ({
  loadCurrentUserRole: loadRoleMock,
}));

vi.mock('../lib/territoryService', () => ({
  generateSubdivisionDrafts: generateSubdivisionDraftsMock,
  loadActiveSubdivisionMemberships: loadActiveMembershipsMock,
  loadMyActiveSubdivisionMembership: loadMyMembershipMock,
  loadVisibleRegionSet: loadVisibleRegionSetMock,
  publishRegionPartition: publishRegionPartitionMock,
  saveRegionPartition: saveRegionPartitionMock,
  saveSubdivisionEdits: saveSubdivisionEditsMock,
  setMySubdivisionMembership: setMyMembershipMock,
  validateRegionPartition: validateRegionPartitionMock,
}));

const urbanAreas = [
  'Distrito Sede',
  'Iguatemi',
  'Floriano',
  'Jardim São Domingos',
  'Venda Duzentos',
  'Projeto Reviver',
  'ZEDE',
];

const validFeature = {
  type: 'Feature',
  properties: {
    area: '',
    coordinate_crs: 'EPSG:4326',
    source_crs: 'EPSG:31982',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-52.03, -23.50],
      [-51.85, -23.50],
      [-51.85, -23.35],
      [-52.03, -23.35],
      [-52.03, -23.50],
    ]],
  },
};

const validBoundary = {
  type: 'FeatureCollection',
  features: urbanAreas.map((area) => ({
    ...validFeature,
    properties: { ...validFeature.properties, area },
  })),
};

beforeEach(() => {
  fitBoundsMock.mockClear();
  mapOnMock.mockClear();
  mapOffMock.mockClear();
  addControlsMock.mockClear();
  removeControlsMock.mockClear();
  setGlobalOptionsMock.mockClear();
  loadRoleMock.mockResolvedValue('participante');
  loadVisibleRegionSetMock.mockResolvedValue(null);
  loadActiveMembershipsMock.mockResolvedValue([]);
  loadMyMembershipMock.mockResolvedValue(null);
  setMyMembershipMock.mockResolvedValue({
    membershipId: '45678901-1234-4234-8234-123456789abc',
    subdivisionId: '34567890-1234-4234-8234-123456789abc',
    changed: true,
  });
  validateRegionPartitionMock.mockResolvedValue({
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
  });
  publishRegionPartitionMock.mockResolvedValue({
    regionSetId: '12345678-1234-4234-8234-123456789abc',
    regionCount: 2,
    status: 'published',
    publishedAt: '2026-10-12T12:00:00.000Z',
  });
  saveRegionPartitionMock.mockResolvedValue('12345678-1234-4234-8234-123456789abc');
  generateSubdivisionDraftsMock.mockResolvedValue({
    regionSetId: '12345678-1234-4234-8234-123456789abc',
    regionId: '23456789-1234-4234-8234-123456789abc',
    targetSubdivisionCount: 5,
    expectedAreaSquareMeters: 100,
    coverageDifferenceSquareMeters: 0,
    subdivisions: Array.from({ length: 5 }, (_, index) => ({
      id: `34567890-1234-4234-8234-123456789ab${index}`,
      number: index + 1,
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
      },
      areaSquareMeters: 100,
      deviationPercent: 0,
    })),
  });
  saveSubdivisionEditsMock.mockResolvedValue({
    regionId: '23456789-1234-4234-8234-123456789abc',
    subdivisionCount: 5,
    coverageDifferenceSquareMeters: 0,
    subdivisions: [],
  });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => validBoundary,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CityMap', () => {
  it('loads every official urban-perimeter polygon over attributed OSM tiles', async () => {
    render(<CityMap />);

    await screen.findByTestId('leaflet-map');
    expect(screen.getByRole('region', { name: 'Mapa urbano principal de Maringá' })).toBeTruthy();
    expect(screen.getByTestId('leaflet-map')).toBeTruthy();
    expect(screen.getByTestId('boundary-feature-count').textContent).toBe('7');
    expect(screen.getByTestId('boundary-feature-count').getAttribute('data-areas'))
      .toContain('Projeto Reviver');
    expect(screen.getByTestId('boundary-feature-count').getAttribute('data-areas'))
      .toContain('ZEDE');
    expect(screen.getByTestId('map-tiles').getAttribute('data-url'))
      .toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(screen.getByTestId('map-tiles').getAttribute('data-attribution'))
      .toContain('OpenStreetMap');
    expect(screen.getByText(/Prefeitura de Maringá/)).toBeTruthy();
  });

  it('loads and selects the published regions and subdivisions for participants', async () => {
    const regionGeometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    };
    loadVisibleRegionSetMock.mockResolvedValueOnce({
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        color: '#c6533d',
        geometry: regionGeometry,
        subdivisions: [1, 2].map((number) => ({
          id: number === 1 ? '34567890-1234-4234-8234-123456789abc' : '45678901-1234-4234-8234-123456789abc',
          number,
          geometry: regionGeometry,
        })),
      }],
    });
    render(<CityMap />);

    expect((await screen.findByTestId('published-region-count')).textContent).toBe('1');
    expect(screen.getByTestId('subdivision-feature-count').textContent).toBe('2');
    expect(screen.getByRole('combobox', { name: 'Região do mapa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar vértices das subdivisões' })).toBeNull();
    expect(screen.getByText('Subdivisões da Região 1: 2')).toBeTruthy();
  });

  it('lets participants enroll in a subdivision and switch while showing their current area', async () => {
    const regionGeometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    };
    const firstSubdivisionId = '34567890-1234-4234-8234-123456789abc';
    const secondSubdivisionId = '45678901-1234-4234-8234-123456789abc';
    loadVisibleRegionSetMock.mockResolvedValueOnce({
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        color: '#c6533d',
        geometry: regionGeometry,
        subdivisions: [firstSubdivisionId, secondSubdivisionId].map((id, index) => ({
          id,
          number: index + 1,
          geometry: regionGeometry,
        })),
      }],
    });
    setMyMembershipMock
      .mockResolvedValueOnce({ membershipId: '56789012-1234-4234-8234-123456789abc', subdivisionId: firstSubdivisionId, changed: true })
      .mockResolvedValueOnce({ membershipId: '67890123-1234-4234-8234-123456789abc', subdivisionId: secondSubdivisionId, changed: true });

    render(<CityMap />);

    expect(await screen.findByRole('heading', { name: 'Inscrição em subdivisão' })).toBeTruthy();
    const destinationSelect = screen.getByRole('combobox', { name: 'Subdivisão desejada' });
    fireEvent.change(destinationSelect, { target: { value: firstSubdivisionId } });
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));
    expect(await screen.findByText('Sua inscrição atual: Região 1, subdivisão 1.')).toBeTruthy();
    expect(setMyMembershipMock).toHaveBeenNthCalledWith(1, firstSubdivisionId);

    fireEvent.change(destinationSelect, { target: { value: secondSubdivisionId } });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar subdivisão' }));
    expect(await screen.findByText('Sua inscrição atual: Região 1, subdivisão 2.')).toBeTruthy();
    expect(setMyMembershipMock).toHaveBeenNthCalledWith(2, secondSubdivisionId);
  });

  it('requires every active participant to select a destination before replacing the map', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_cidade');
    const regionGeometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    };
    loadVisibleRegionSetMock.mockResolvedValueOnce({
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'published',
      publishedAt: '2026-10-12T12:00:00.000Z',
      publishedRegionSetId: '12345678-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      regions: [{
        id: '23456789-1234-4234-8234-123456789abc',
        number: 1,
        color: '#c6533d',
        geometry: regionGeometry,
        subdivisions: [{
          id: '34567890-1234-4234-8234-123456789abc',
          number: 1,
          geometry: regionGeometry,
        }],
      }],
    });
    loadActiveMembershipsMock.mockResolvedValueOnce([
      {
        id: '45678901-1234-4234-8234-123456789abc',
        participantId: '56789012-1234-4234-8234-123456789abc',
        participantName: 'Ana Participante',
        subdivisionId: '34567890-1234-4234-8234-123456789abc',
        regionNumber: 1,
        subdivisionNumber: 1,
      },
      {
        id: '67890123-1234-4234-8234-123456789abc',
        participantId: '78901234-1234-4234-8234-123456789abc',
        participantName: 'Bruno Participante',
        subdivisionId: '34567890-1234-4234-8234-123456789abc',
        regionNumber: 1,
        subdivisionNumber: 1,
      },
    ]);
    render(<CityMap />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preparar substituição' }));
    expect(await screen.findByText(/Inscrições para realinhamento/)).toBeTruthy();
    expect(screen.getByText(/Ana Participante/)).toBeTruthy();
    expect(screen.getByText(/Bruno Participante/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publicar substituição' })).toBeNull();

    const createHandler = mapOnMock.mock.calls.find(([eventName]) => eventName === 'pm:create')?.[1];
    act(() => createHandler({
      layer: {
        setStyle: vi.fn(),
        toGeoJSON: () => ({ type: 'Feature', properties: {}, geometry: validFeature.geometry }),
        remove: vi.fn(),
      },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Validar no PostGIS' }));
    await screen.findByText(/PostGIS aprovou a pré-validação/);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText(/Rascunho salvo.*não publicado/);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar subdivisões' }));
    await screen.findByText('Subdivisões da Região 1: 5');
    expect(screen.queryByRole('button', { name: 'Publicar substituição' })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: /Ana Participante/ }), {
      target: { value: '34567890-1234-4234-8234-123456789ab0' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /Bruno Participante/ }), {
      target: { value: '34567890-1234-4234-8234-123456789ab1' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar substituição' }));

    await waitFor(() => expect(publishRegionPartitionMock).toHaveBeenCalledWith(
      '12345678-1234-4234-8234-123456789abc',
      [
        {
          membershipId: '45678901-1234-4234-8234-123456789abc',
          subdivisionId: '34567890-1234-4234-8234-123456789ab0',
        },
        {
          membershipId: '67890123-1234-4234-8234-123456789abc',
          subdivisionId: '34567890-1234-4234-8234-123456789ab1',
        },
      ],
    ));
  });

  it('resumes a saved replacement draft with its membership list and destination IDs', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_cidade');
    const geometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    };
    loadVisibleRegionSetMock.mockResolvedValueOnce({
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      status: 'draft',
      publishedAt: null,
      publishedRegionSetId: '23456789-1234-4234-8234-123456789abc',
      targetRegionCount: 1,
      regions: [{
        id: '34567890-1234-4234-8234-123456789abc',
        number: 1,
        color: '#c6533d',
        geometry,
        subdivisions: [{
          id: '45678901-1234-4234-8234-123456789abc',
          number: 1,
          geometry,
        }],
      }],
    });
    loadActiveMembershipsMock.mockResolvedValueOnce([{
      id: '56789012-1234-4234-8234-123456789abc',
      participantId: '67890123-1234-4234-8234-123456789abc',
      participantName: 'Pessoa Retomada',
      subdivisionId: '78901234-1234-4234-8234-123456789abc',
      regionNumber: 1,
      subdivisionNumber: 1,
    }]);

    render(<CityMap />);

    expect(await screen.findByRole('heading', { name: 'Inscrições para realinhamento' })).toBeTruthy();
    expect(screen.getByText(/Pessoa Retomada/)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Pessoa Retomada/ }).querySelector('option[value="45678901-1234-4234-8234-123456789abc"]'))
      .toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preparar substituição' })).toBeNull();
  });

  it('fits all legal polygons to the viewport after loading', async () => {
    render(<CityMap />);

    await screen.findByTestId('leaflet-map');
    await waitFor(() => expect(fitBoundsMock).toHaveBeenCalledOnce());
    expect(fitBoundsMock.mock.calls[0][1]).toEqual({
      padding: [28, 28],
      maxZoom: 11,
    });
  });

  it('re-fits the complete perimeter when the map container resizes', async () => {
    const { unmount } = render(<CityMap />);

    await screen.findByTestId('leaflet-map');
    const resizeHandler = mapOnMock.mock.calls.find(([eventName]) => eventName === 'resize')?.[1];
    expect(resizeHandler).toBeTypeOf('function');
    resizeHandler();
    expect(fitBoundsMock).toHaveBeenCalledTimes(2);

    unmount();
    expect(mapOffMock).toHaveBeenCalledWith('resize', resizeHandler);
  });

  it('lets only city leaders create local region drafts without saving them', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_cidade');
    render(<CityMap />);

    expect(await screen.findByText(/Rascunhos locais: 0/)).toBeTruthy();
    await waitFor(() => {
      expect(addControlsMock).toHaveBeenCalledWith(expect.objectContaining({ drawPolygon: true }));
    });

    const targetCountInput = screen.getByRole('spinbutton', { name: 'Quantidade de regiões' });
    expect((targetCountInput as HTMLInputElement).value).toBe('1');
    fireEvent.change(targetCountInput, { target: { value: '2' } });
    expect((targetCountInput as HTMLInputElement).value).toBe('2');

    const createHandler = mapOnMock.mock.calls.find(([eventName]) => eventName === 'pm:create')?.[1];
    expect(createHandler).toBeTypeOf('function');
    const toGeoJSONMock = vi.fn(() => ({
      type: 'Feature' as const,
      properties: {},
      geometry: validFeature.geometry,
    }));
    const removeLayerMock = vi.fn();
    act(() => createHandler({
      layer: {
        setStyle: vi.fn(),
        toGeoJSON: toGeoJSONMock,
        remove: removeLayerMock,
      },
    }));
    expect(toGeoJSONMock).toHaveBeenCalledWith(15);

    const draftStatus = screen.getByText(/Rascunhos locais/);
    expect(draftStatus.textContent).toContain('Rascunhos locais: 1 de 2');
    expect(draftStatus.textContent).toContain('Desvio máximo estimado:');
    expect(draftStatus.textContent).toContain('Não validados nem salvos');

    fireEvent.change(targetCountInput, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar no PostGIS' }));
    expect(await screen.findByText(/PostGIS aprovou a pré-validação/)).toBeTruthy();
    expect(validateRegionPartitionMock).toHaveBeenCalledWith([validFeature.geometry], 1);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar rascunhos' }));
    expect(removeLayerMock).toHaveBeenCalledOnce();
    expect(screen.getByText(/Rascunhos locais/).textContent).toContain('0 de 1');
    expect(screen.queryByText(/PostGIS aprovou a pré-validação/)).toBeNull();
  });

  it('does not expose region drawing controls to participants', async () => {
    loadRoleMock.mockResolvedValueOnce('participante');
    render(<CityMap />);

    await screen.findByTestId('leaflet-map');
    expect(addControlsMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Rascunhos locais/)).toBeNull();
  });

  it('groups separate drawn components into a MultiPolygon region', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_cidade');
    validateRegionPartitionMock.mockResolvedValueOnce({
      targetRegionCount: 2,
      draftRegionCount: 2,
      expectedAreaSquareMeters: 100,
      draftCountMatchesTarget: true,
      allContained: true,
      allWithinAreaTolerance: true,
      maximumDeviationPercent: 0,
      hasOverlaps: false,
      coverageDifferenceSquareMeters: 0,
      passesValidation: true,
      regions: [],
    });
    render(<CityMap />);

    await screen.findByText(/Rascunhos locais: 0/);
    await waitFor(() => expect(addControlsMock).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade de regiões' }), {
      target: { value: '2' },
    });
    const firstRegionColor = screen.getByLabelText('Cor da região 1');
    expect((firstRegionColor as HTMLInputElement).value).toBe('#c6533d');
    fireEvent.change(firstRegionColor, { target: { value: '#118877' } });
    expect((firstRegionColor as HTMLInputElement).value).toBe('#118877');
    const selectedRegion = screen.getByRole('combobox', { name: 'Região do desenho' });
    expect(selectedRegion).toBeTruthy();

    const createHandler = mapOnMock.mock.calls.find(([eventName]) => eventName === 'pm:create')?.[1];
    const firstComponent: Geometry = {
      type: 'Polygon',
      coordinates: [[[-52.03, -23.50], [-51.96, -23.50], [-51.96, -23.35], [-52.03, -23.35], [-52.03, -23.50]]],
    };
    const secondComponent: Geometry = {
      type: 'Polygon',
      coordinates: [[[-51.94, -23.50], [-51.87, -23.50], [-51.87, -23.35], [-51.94, -23.35], [-51.94, -23.50]]],
    };
    const otherRegion: Geometry = {
      type: 'Polygon',
      coordinates: [[[-51.955, -23.50], [-51.945, -23.50], [-51.945, -23.35], [-51.955, -23.35], [-51.955, -23.50]]],
    };
    const draw = (geometry: Geometry) => act(() => createHandler({
      layer: {
        setStyle: vi.fn(),
        toGeoJSON: () => ({ type: 'Feature', properties: {}, geometry }),
        remove: vi.fn(),
      },
    }));

    draw(firstComponent);
    draw(secondComponent);
    expect(screen.getByText(/Rascunhos locais/).textContent).toContain('1 de 2');

    fireEvent.change(selectedRegion, { target: { value: '1' } });
    expect((screen.getByLabelText('Cor da região 2') as HTMLInputElement).value).toBe('#287a8c');
    draw(otherRegion);
    expect(screen.getByText(/Rascunhos locais/).textContent).toContain('2 de 2');
    fireEvent.click(screen.getByRole('button', { name: 'Validar no PostGIS' }));

    expect(await screen.findByText(/PostGIS aprovou a pré-validação/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText(/Rascunho salvo.*não publicado/)).toBeTruthy();
    expect((screen.getByRole('spinbutton', { name: 'Subdivisões na região 2' }) as HTMLInputElement).value)
      .toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar subdivisões' }));
    expect(await screen.findByText('Subdivisões da Região 2: 5')).toBeTruthy();
    expect(generateSubdivisionDraftsMock).toHaveBeenCalledWith(
      '12345678-1234-4234-8234-123456789abc',
      2,
      5,
    );
    expect(screen.getByTestId('subdivision-feature-count').textContent).toBe('5');
    expect(screen.queryByRole('button', { name: 'Publicar mapa' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar vértices das subdivisões' })).toBeTruthy();
    subdivisionLayerEnableMock.mockClear();
    subdivisionLayerOnMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Editar vértices das subdivisões' }));
    await waitFor(() => {
      expect(subdivisionLayerEnableMock).toHaveBeenCalledWith({ allowSelfIntersection: false });
    });
    const editHandler = subdivisionLayerOnMock.mock.calls.find(([eventName]) => eventName === 'pm:edit')?.[1];
    expect(editHandler).toBeTypeOf('function');
    act(() => editHandler());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edições' }));
    await waitFor(() => expect(saveSubdivisionEditsMock).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Editar vértices das subdivisões' })).toBeTruthy();
    expect(saveSubdivisionEditsMock).toHaveBeenCalledWith(
      '23456789-1234-4234-8234-123456789abc',
      expect.arrayContaining([expect.objectContaining({ number: 1, geometry: expect.objectContaining({ type: 'MultiPolygon' }) })]),
    );
    expect(screen.queryByRole('button', { name: 'Publicar mapa' })).toBeNull();
    fireEvent.change(selectedRegion, { target: { value: '0' } });
    const firstSubdivisionCount = screen.getByRole('spinbutton', { name: 'Subdivisões na região 1' });
    expect((firstSubdivisionCount as HTMLInputElement).value).toBe('5');
    fireEvent.change(firstSubdivisionCount, { target: { value: '3' } });
    generateSubdivisionDraftsMock.mockResolvedValueOnce({
      regionSetId: '12345678-1234-4234-8234-123456789abc',
      regionId: '34567890-1234-4234-8234-123456789abc',
      targetSubdivisionCount: 3,
      expectedAreaSquareMeters: 100,
      coverageDifferenceSquareMeters: 0,
      subdivisions: Array.from({ length: 3 }, (_, index) => ({
        id: `45678901-1234-4234-8234-123456789ab${index}`,
        number: index + 1,
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        },
        areaSquareMeters: 100,
        deviationPercent: 0,
      })),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar subdivisões' }));
    expect(await screen.findByText('Subdivisões da Região 1: 3')).toBeTruthy();
    fireEvent.change(selectedRegion, { target: { value: '1' } });
    const publishButton = await screen.findByRole('button', { name: 'Publicar mapa' });
    fireEvent.click(publishButton);
    expect(await screen.findByText(/Mapa publicado para participantes/)).toBeTruthy();
    expect(publishRegionPartitionMock).toHaveBeenCalledWith('12345678-1234-4234-8234-123456789abc');
    expect(screen.queryByRole('button', { name: 'Publicar mapa' })).toBeNull();
    const [regions, targetCount] = validateRegionPartitionMock.mock.calls[0];
    expect(targetCount).toBe(2);
    expect(regions).toHaveLength(2);
    expect(regions[0].type).toBe('MultiPolygon');
    expect(regions[0].coordinates).toHaveLength(2);
    expect(saveRegionPartitionMock).toHaveBeenCalledWith(regions, 2, ['#118877', '#287a8c']);
  });

  it('rejects a boundary whose coordinate CRS is not WGS84', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...validBoundary,
        features: validBoundary.features.map((feature, index) => index === 0
          ? {
            ...feature,
            properties: { ...feature.properties, coordinate_crs: 'EPSG:31982' },
          }
          : feature),
      }),
    });
    render(<CityMap />);

    const error = await screen.findByRole('alert');
    expect(error.textContent?.toLowerCase()).toContain('coordenadas do perímetro não são wgs84');
    expect(screen.queryByTestId('leaflet-map')).toBeNull();
  });

  it('rejects a boundary without an explicit coordinate CRS', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...validBoundary,
        features: validBoundary.features.map((feature, index) => index === 0
          ? {
            ...feature,
            properties: { area: 'Distrito Sede', source_crs: 'EPSG:31982' },
          }
          : feature),
      }),
    });
    render(<CityMap />);

    const error = await screen.findByRole('alert');
    expect(error.textContent?.toLowerCase()).toContain('coordenadas do perímetro não são wgs84');
    expect(screen.queryByTestId('leaflet-map')).toBeNull();
  });

  it('rejects coordinates outside the expected urban-seat extent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...validBoundary,
        features: validBoundary.features.map((feature, index) => index === 0
          ? {
            ...feature,
            geometry: {
              type: 'Polygon',
              coordinates: [[[390000, 7410000], [391000, 7410000], [391000, 7411000], [390000, 7410000]]],
            },
          }
          : feature),
      }),
    });
    render(<CityMap />);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('fora da área esperada de Maringá');
    expect(screen.queryByTestId('leaflet-map')).toBeNull();
  });
});