import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActAgenda from './ActAgenda';

const { cancelMyRegistrationMock, listActsMock, listMyActiveActIdsMock, loadRoleMock, registerForActMock } = vi.hoisted(() => ({
  cancelMyRegistrationMock: vi.fn(),
  listActsMock: vi.fn(),
  listMyActiveActIdsMock: vi.fn(),
  loadRoleMock: vi.fn(),
  registerForActMock: vi.fn(),
}));

vi.mock('../../identity-access/lib/roleManagementService', () => ({
  loadCurrentUserRole: loadRoleMock,
}));

vi.mock('../lib/actService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/actService')>();
  return {
    ...actual,
    cancelMyActRegistration: cancelMyRegistrationMock,
    listActs: listActsMock,
    listMyActiveActIds: listMyActiveActIdsMock,
    registerForAct: registerForActMock,
  };
});

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children }: { children: React.ReactNode }) => <output data-testid="act-marker">{children}</output>,
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="acts-map">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => <output data-testid="acts-map-tiles" />,
}));

const subdivisionActId = '23456789-1234-4234-8234-123456789abc';
const cityActId = '34567890-1234-4234-8234-123456789abc';
const cancelledActId = '45678901-1234-4234-8234-123456789abc';
const futureAct = {
  id: subdivisionActId,
  title: 'Panfletagem no Centro',
  category: 'leaflet_distribution' as const,
  otherDetail: null,
  startsAt: '2026-10-20T21:00:00.000Z',
  meetingLocation: { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] },
  meetingAddress: 'Praça da Catedral',
  subdivisionId: '56789012-1234-4234-8234-123456789abc',
  scope: 'subdivision' as const,
  status: 'scheduled' as const,
};
const cityAct = {
  ...futureAct,
  id: cityActId,
  title: 'Assembleia da cidade',
  category: 'meeting' as const,
  subdivisionId: null,
  scope: 'city' as const,
};
const cancelledAct = {
  ...futureAct,
  id: cancelledActId,
  title: 'Ato cancelado',
  status: 'cancelled' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  loadRoleMock.mockResolvedValue('participante');
  listActsMock.mockResolvedValue([futureAct, cityAct, cancelledAct]);
  listMyActiveActIdsMock.mockResolvedValue([]);
  registerForActMock.mockResolvedValue(true);
  cancelMyRegistrationMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActAgenda', () => {
  it('lets participants register for an act outside their own subdivision and cancel before it starts', async () => {
    const user = userEvent.setup();
    listMyActiveActIdsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subdivisionActId])
      .mockResolvedValueOnce([]);
    render(<ActAgenda />);

    expect(await screen.findByText('Panfletagem no Centro')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Inscrever-se em Panfletagem no Centro' }));

    await waitFor(() => expect(registerForActMock).toHaveBeenCalledWith(subdivisionActId));
    expect(await screen.findByRole('button', { name: 'Cancelar inscrição em Panfletagem no Centro' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancelar inscrição em Panfletagem no Centro' }));

    await waitFor(() => expect(cancelMyRegistrationMock).toHaveBeenCalledWith(subdivisionActId));
    expect(await screen.findByRole('button', { name: 'Inscrever-se em Panfletagem no Centro' })).toBeTruthy();
  });

  it('shows cancelled acts without registration controls and displays acts on the map', async () => {
    const user = userEvent.setup();
    render(<ActAgenda />);

    expect(await screen.findByText('Ato cancelado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inscrever-se em Ato cancelado' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('acts-map')).toBeTruthy();
    expect(screen.getAllByTestId('act-marker')).toHaveLength(3);
  });

  it('does not show the participant agenda to leadership users', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_cidade');
    render(<ActAgenda />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agenda de atos' })).toBeNull());
    expect(listActsMock).not.toHaveBeenCalled();
  });
});
