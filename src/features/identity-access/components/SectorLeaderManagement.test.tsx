import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SectorLeaderManagement from './SectorLeaderManagement';

const { loadCandidatesMock, setSectorLeaderMock } = vi.hoisted(() => ({
  loadCandidatesMock: vi.fn(),
  setSectorLeaderMock: vi.fn(),
}));

vi.mock('../lib/roleManagementService', () => ({
  loadSectorLeaderCandidates: loadCandidatesMock,
  setSectorLeader: setSectorLeaderMock,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  loadCandidatesMock.mockResolvedValue({
    isCityLeader: true,
    candidates: [{ id: 'participant-1', name: 'Participante Um', role: 'participante' }],
  });
  setSectorLeaderMock.mockResolvedValue(undefined);
});

describe('SectorLeaderManagement', () => {
  it('does not show role management to a sector leader', async () => {
    loadCandidatesMock.mockResolvedValueOnce({ isCityLeader: false, candidates: [] });
    render(<SectorLeaderManagement />);

    expect(await screen.queryByRole('heading', { name: 'Lideranças de setor' })).toBeNull();
  });

  it('announces a generic load error without exposing role controls', async () => {
    loadCandidatesMock.mockRejectedValueOnce(new Error('Não foi possível carregar a equipe da cidade.'));
    render(<SectorLeaderManagement />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Não foi possível carregar a equipe da cidade.');
    expect(screen.queryByRole('heading', { name: 'Lideranças de setor' })).toBeNull();
  });

  it('lets a city leader promote and remove a sector leader', async () => {
    const user = userEvent.setup();
    render(<SectorLeaderManagement />);

    await user.click(await screen.findByRole('button', {
      name: 'Promover Participante Um a líder de setor',
    }));
    expect(setSectorLeaderMock).toHaveBeenCalledWith('participant-1', true);
    expect(await screen.findByRole('button', {
      name: 'Remover liderança de setor de Participante Um',
    })).toBeTruthy();

    await user.click(screen.getByRole('button', {
      name: 'Remover liderança de setor de Participante Um',
    }));
    expect(setSectorLeaderMock).toHaveBeenLastCalledWith('participant-1', false);
    expect(await screen.findByRole('button', {
      name: 'Promover Participante Um a líder de setor',
    })).toBeTruthy();
  });
});