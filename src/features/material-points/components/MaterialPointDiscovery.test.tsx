import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MaterialPointDiscovery from './MaterialPointDiscovery';

const { listMaterialPointsMock, loadRoleMock } = vi.hoisted(() => ({
  listMaterialPointsMock: vi.fn(),
  loadRoleMock: vi.fn(),
}));

vi.mock('../../identity-access/lib/roleManagementService', () => ({
  loadCurrentUserRole: loadRoleMock,
}));

vi.mock('../lib/materialPointService', () => ({
  listMaterialPoints: listMaterialPointsMock,
}));

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children, eventHandlers }: { children: ReactNode; eventHandlers: { click: () => void } }) => (
    <button data-testid="material-point-marker" onClick={eventHandlers.click} type="button">{children}</button>
  ),
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="material-points-map">{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TileLayer: () => <span data-testid="material-points-tiles" />,
}));

const points = [
  {
    id: '12345678-1234-4234-8234-123456789abc',
    name: 'Ponto Centro',
    materialType: 'Panfletos',
    topic: 'Mobilização estudantil',
    address: 'Praça da Catedral, s/n',
    location: { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] },
    pickupWindows: [
      { dayOfWeek: 1 as const, startsAt: '09:00', endsAt: '11:00' },
      { dayOfWeek: 1 as const, startsAt: '14:00', endsAt: '16:00' },
    ],
  },
  {
    id: '23456789-1234-4234-8234-123456789abc',
    name: 'Ponto Universidade',
    materialType: 'Lambe-lambe',
    topic: 'Transporte público',
    address: 'Av. Colombo, 5790',
    location: { type: 'Point' as const, coordinates: [-51.94, -23.41] as [number, number] },
    pickupWindows: [{ dayOfWeek: 3 as const, startsAt: '18:00', endsAt: '20:00' }],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  loadRoleMock.mockResolvedValue('participante');
  listMaterialPointsMock.mockResolvedValue(points);
});

afterEach(() => {
  cleanup();
});

describe('MaterialPointDiscovery', () => {
  it('shows filtered points in a list and opens shared details from list or map marker', async () => {
    const user = userEvent.setup();
    render(<MaterialPointDiscovery />);

    expect(await screen.findByRole('heading', { name: 'Materiais para mobilização' })).toBeTruthy();
    expect(screen.getByText('Ponto Centro')).toBeTruthy();
    expect(screen.getByText('Ponto Universidade')).toBeTruthy();
    expect(screen.queryByText(/Estoque|Reservar|Retirar material/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ver detalhes de Ponto Centro' }));
    expect(screen.getByRole('region', { name: 'Ponto Centro' })).toBeTruthy();
    expect(screen.getByText('Mobilização estudantil')).toBeTruthy();
    expect(screen.getByText('Segunda-feira · 09:00–11:00')).toBeTruthy();
    expect(screen.getByText('Segunda-feira · 14:00–16:00')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('material-points-map')).toBeTruthy();
    await user.click(screen.getAllByTestId('material-point-marker')[0]);
    expect(screen.getByRole('region', { name: 'Ponto Centro' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar material ou tema' }), 'transporte');
    expect(screen.getByText('Ponto Universidade')).toBeTruthy();
    expect(screen.queryByText('Ponto Centro')).toBeNull();
  });

  it('does not load participant discovery for leadership accounts', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_setor');
    render(<MaterialPointDiscovery />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Locais de retirada' })).toBeNull());
    expect(listMaterialPointsMock).not.toHaveBeenCalled();
  });
});