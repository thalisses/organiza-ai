import { useEffect, useState } from 'react';
import {
  loadSectorLeaderCandidates,
  setSectorLeader,
  type SectorLeaderCandidate,
} from '../lib/roleManagementService';

export default function SectorLeaderManagement() {
  const [candidates, setCandidates] = useState<SectorLeaderCandidate[]>([]);
  const [isCityLeader, setIsCityLeader] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isCancelled = false;

    void loadSectorLeaderCandidates()
      .then((directory) => {
        if (!isCancelled) {
          setIsCityLeader(directory.isCityLeader);
          setCandidates(directory.candidates);
        }
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar a equipe da cidade.',
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleRoleChange(candidate: SectorLeaderCandidate) {
    const isPromoting = candidate.role === 'participante';
    setUpdatingId(candidate.id);
    setError('');
    setNotice('');

    try {
      await setSectorLeader(candidate.id, isPromoting);
      setCandidates((currentCandidates) => currentCandidates.map((currentCandidate) => (
        currentCandidate.id === candidate.id
          ? { ...currentCandidate, role: isPromoting ? 'lider_setor' : 'participante' }
          : currentCandidate
      )));
      setNotice(
        isPromoting
          ? `Liderança de setor atribuída para ${candidate.name}.`
          : `Liderança de setor removida de ${candidate.name}.`,
      );
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : 'Não foi possível atualizar a liderança de setor.',
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return <p role="status">Verificando permissões de liderança…</p>;
  }

  if (!isCityLeader) {
    return error ? <p className="auth-error" role="alert">{error}</p> : null;
  }

  return (
    <section className="sector-leader-management" aria-labelledby="sector-leader-title">
      <h2 id="sector-leader-title">Lideranças de setor</h2>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}

      {candidates.length === 0 ? (
        <p className="sector-leader-empty">Nenhum participante disponível.</p>
      ) : (
        <ul className="sector-leader-list" aria-label="Participantes da cidade">
          {candidates.map((candidate) => {
            const isSectorLeader = candidate.role === 'lider_setor';
            return (
              <li key={candidate.id}>
                <div className="sector-leader-person">
                  <span className="sector-leader-name">{candidate.name}</span>
                  <span className="sector-leader-role">
                    {isSectorLeader ? 'Líder de setor' : 'Participante'}
                  </span>
                </div>
                <button
                  disabled={updatingId !== null}
                  onClick={() => void handleRoleChange(candidate)}
                  type="button"
                >
                  {updatingId === candidate.id
                    ? 'Salvando…'
                    : isSectorLeader
                      ? `Remover liderança de setor de ${candidate.name}`
                      : `Promover ${candidate.name} a líder de setor`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}