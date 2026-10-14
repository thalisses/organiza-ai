import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MaterialPointManagement from './MaterialPointManagement';

const { deletePointMock, listPointsMock, loadRoleMock, savePointMock } = vi.hoisted(() => ({
  deletePointMock: vi.fn(),
  listPointsMock: vi.fn(),
  loadRoleMock: vi.fn(),
  savePointMock: vi.fn(),
}));

vi.mock('../../identity-access/lib/roleManagementService', () => ({
  loadCurrentUserRole: loadRoleMock,
}));

vi.mock('../lib/materialPointService', () => ({
  deleteMaterialPoint: deletePointMock,
  listMaterialPoints: listPointsMock,
  saveMaterialPoint: savePointMock,
}));

const pointId = '12345678-1234-4234-8234-123456789abc';
const point = {
  id: pointId,
  name: 'Ponto Centro',
  materialType: 'Panfletos',
  topic: 'Mobilização territorial',
  address: 'Praça da Catedral, s/n',
  location: { type: 'Point' as const, coordinates: [-51.95, -23.42] as [number, number] },
  pickupWindows: [{ dayOfWeek: 1, startsAt: '09:00', endsAt: '11:00' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  loadRoleMock.mockResolvedValue('lider_cidade');
  listPointsMock.mockResolvedValue([]);
  savePointMock.mockResolvedValue(pointId);
  deletePointMock.mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MaterialPointManagement', () => {
  it('creates a free-text point with recurring multiple pickup windows', async () => {
    const user = userEvent.setup();
    render(<MaterialPointManagement />);

    expect(await screen.findByRole('heading', { name: 'Locais de retirada' })).toBeTruthy();
    await user.type(screen.getByLabelText('Nome do ponto'), 'Ponto Centro');
    await user.type(screen.getByLabelText('Tipo de material'), 'Panfletos');
    await user.type(screen.getByLabelText('Tema'), 'Mobilização territorial');
    await user.type(screen.getByLabelText('Endereço'), 'Praça da Catedral, s/n');
    await user.type(screen.getByLabelText('Longitude'), '-51.95');
    await user.type(screen.getByLabelText('Latitude'), '-23.42');
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    fireEvent.change(screen.getAllByLabelText('Horário inicial')[1], { target: { value: '14:00' } });
    fireEvent.change(screen.getAllByLabelText('Horário final')[1], { target: { value: '16:00' } });
    await user.click(screen.getByRole('button', { name: 'Salvar ponto' }));

    await waitFor(() => expect(savePointMock).toHaveBeenCalledWith(expect.objectContaining({
      id: null,
      name: 'Ponto Centro',
      materialType: 'Panfletos',
      topic: 'Mobilização territorial',
      longitude: -51.95,
      latitude: -23.42,
      pickupWindows: [
        { dayOfWeek: 1, startsAt: '09:00', endsAt: '11:00' },
        { dayOfWeek: 1, startsAt: '14:00', endsAt: '16:00' },
      ],
    })));
  });

  it('hides management controls from participants', async () => {
    loadRoleMock.mockResolvedValueOnce('participante');
    render(<MaterialPointManagement />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Locais de retirada' })).toBeNull());
    expect(listPointsMock).not.toHaveBeenCalled();
  });

  it('lets sector leaders edit and delete points without territorial assignment', async () => {
    const user = userEvent.setup();
    loadRoleMock.mockResolvedValueOnce('lider_setor');
    listPointsMock
      .mockResolvedValueOnce([point])
      .mockResolvedValueOnce([{ ...point, name: 'Ponto Atualizado' }])
      .mockResolvedValueOnce([]);
    render(<MaterialPointManagement />);

    await user.click(await screen.findByRole('button', { name: 'Editar Ponto Centro' }));
    const nameInput = screen.getByLabelText('Nome do ponto') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Ponto Atualizado');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Ponto Atualizado')).toBeTruthy();
    expect(savePointMock).toHaveBeenCalledWith(expect.objectContaining({ id: pointId, name: 'Ponto Atualizado' }));

    await user.click(screen.getByRole('button', { name: 'Excluir Ponto Atualizado' }));
    await waitFor(() => expect(deletePointMock).toHaveBeenCalledWith(pointId));
    expect(await screen.findByText('Nenhum ponto cadastrado.')).toBeTruthy();
  });
});
