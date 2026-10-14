import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActManagement from './ActManagement';

const {
  cancelActMock,
  getActAttendeesMock,
  listActsMock,
  listManageableActSubdivisionsMock,
  loadRoleMock,
  saveActMock,
} = vi.hoisted(() => ({
  cancelActMock: vi.fn(),
  getActAttendeesMock: vi.fn(),
  listActsMock: vi.fn(),
  listManageableActSubdivisionsMock: vi.fn(),
  loadRoleMock: vi.fn(),
  saveActMock: vi.fn(),
}));

vi.mock('../../identity-access/lib/roleManagementService', () => ({
  loadCurrentUserRole: loadRoleMock,
}));

vi.mock('../lib/actService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/actService')>();
  return {
    ...actual,
    cancelAct: cancelActMock,
    getActAttendees: getActAttendeesMock,
    listActs: listActsMock,
    listManageableActSubdivisions: listManageableActSubdivisionsMock,
    saveAct: saveActMock,
  };
});

const subdivisionId = '23456789-1234-4234-8234-123456789abc';
const actId = '12345678-1234-4234-8234-123456789abc';
const savedAct = {
  id: actId,
  title: 'Panfletagem Centro',
  category: 'leaflet_distribution' as const,
  otherDetail: null,
  startsAt: '2026-10-20T21:00:00.000Z',
  meetingLocation: { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] },
  meetingAddress: 'Praça da Catedral',
  subdivisionId,
  scope: 'subdivision' as const,
  status: 'scheduled' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  loadRoleMock.mockResolvedValue('lider_cidade');
  listActsMock.mockResolvedValue([]);
  listManageableActSubdivisionsMock.mockResolvedValue([
    { id: subdivisionId, regionNumber: 2, subdivisionNumber: 4 },
  ]);
  saveActMock.mockResolvedValue(actId);
  cancelActMock.mockResolvedValue(undefined);
  getActAttendeesMock.mockResolvedValue([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActManagement', () => {
  it('lets city leaders create a city-wide act with category, date and point', async () => {
    const user = userEvent.setup();
    render(<ActManagement />);

    expect(await screen.findByRole('heading', { name: 'Gestão de atos' })).toBeTruthy();
    await user.type(screen.getByLabelText('Título'), 'Ato público no centro');
    await user.selectOptions(screen.getByLabelText('Categoria'), 'public_rally');
    fireEvent.change(screen.getByLabelText('Data e horário de início'), {
      target: { value: '2026-10-20T18:00' },
    });
    await user.type(screen.getByLabelText('Endereço de encontro'), 'Praça da Catedral');
    await user.type(screen.getByLabelText('Longitude'), '-51.95');
    await user.type(screen.getByLabelText('Latitude'), '-23.42');
    await user.click(screen.getByRole('button', { name: 'Publicar ato' }));

    await waitFor(() => expect(saveActMock).toHaveBeenCalledWith(expect.objectContaining({
      id: null,
      category: 'public_rally',
      subdivisionId: null,
      startsAt: '2026-10-20T21:00:00.000Z',
      longitude: -51.95,
      latitude: -23.42,
    })));
  });

  it('limits sector leaders to their assigned subdivisions', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_setor');
    render(<ActManagement />);

    expect(await screen.findByRole('heading', { name: 'Gestão de atos' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Cidade inteira' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Região 2, subdivisão 4' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Região 1, subdivisão 1' })).toBeNull();
  });

  it('shows act actions only for scopes a sector leader is assigned to', async () => {
    loadRoleMock.mockResolvedValueOnce('lider_setor');
    listManageableActSubdivisionsMock.mockResolvedValueOnce([
      { id: subdivisionId, regionNumber: 2, subdivisionNumber: 4 },
    ]);
    listActsMock.mockResolvedValueOnce([
      { ...savedAct, id: '11111111-1111-4111-8111-111111111111', title: 'City Act', subdivisionId: null, scope: 'city' },
      savedAct,
      { ...savedAct, id: '22222222-2222-4222-8222-222222222222', title: 'Unassigned Act', subdivisionId: '34567890-1234-4234-8234-123456789abc' },
    ]);
    render(<ActManagement />);

    expect(await screen.findByRole('heading', { name: 'Gestão de atos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar City Act' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar City Act' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar Unassigned Act' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver inscritos City Act' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver inscritos Unassigned Act' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar Panfletagem Centro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver inscritos Panfletagem Centro' })).toBeTruthy();
  });

  it('loads attendee names and WhatsApp only after an authorized leader opens the roster', async () => {
    const user = userEvent.setup();
    const attendee = {
      registrationId: '45678901-1234-4234-8234-123456789abc',
      participantName: 'Pessoa Inscrita',
      whatsappE164: '+5511999991234',
      registeredAt: '2026-10-13T12:00:00.000Z',
    };
    listActsMock.mockResolvedValueOnce([savedAct]);
    getActAttendeesMock.mockResolvedValueOnce([attendee]);
    render(<ActManagement />);

    await user.click(await screen.findByRole('button', { name: 'Ver inscritos Panfletagem Centro' }));

    expect(await screen.findByText('Pessoa Inscrita')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/5511999991234');
    expect(getActAttendeesMock).toHaveBeenCalledWith(actId);
  });

  it('edits an existing act without changing its stable ID', async () => {
    const user = userEvent.setup();
    listActsMock
      .mockResolvedValueOnce([savedAct])
      .mockResolvedValueOnce([{ ...savedAct, title: 'Panfletagem Atualizada' }]);
    saveActMock.mockResolvedValueOnce(actId);
    render(<ActManagement />);

    await user.click(await screen.findByRole('button', { name: 'Editar Panfletagem Centro' }));
    const titleInput = screen.getByLabelText('Título') as HTMLInputElement;
    expect(titleInput.value).toBe('Panfletagem Centro');
    await user.clear(titleInput);
    await user.type(titleInput, 'Panfletagem Atualizada');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Panfletagem Atualizada')).toBeTruthy();
    expect(saveActMock).toHaveBeenCalledWith(expect.objectContaining({
      id: actId,
      title: 'Panfletagem Atualizada',
      subdivisionId,
    }));
  });

  it('cancels an act without removing its cancelled record from the list', async () => {
    const user = userEvent.setup();
    listActsMock
      .mockResolvedValueOnce([savedAct])
      .mockResolvedValueOnce([{ ...savedAct, status: 'cancelled' }]);
    render(<ActManagement />);

    expect(await screen.findByText('Panfletagem Centro')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancelar Panfletagem Centro' }));

    await waitFor(() => expect(cancelActMock).toHaveBeenCalledWith(actId));
    expect(await screen.findByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Panfletagem Centro')).toBeTruthy();
  });
});
