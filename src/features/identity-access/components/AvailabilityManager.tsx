import { useEffect, useState, type FormEvent } from 'react';
import {
  loadMyAvailability,
  replaceMyAvailability,
  type AvailabilityWindow,
} from '../lib/availabilityService';
import AvailabilityEditor from './AvailabilityEditor';

export default function AvailabilityManager() {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    void loadMyAvailability()
      .then((loadedWindows) => {
        if (!isCancelled) {
          setWindows(loadedWindows);
        }
      })
      .catch((loadFailure: unknown) => {
        if (!isCancelled) {
          setLoadError(
            loadFailure instanceof Error
              ? loadFailure.message
              : 'Não foi possível carregar sua disponibilidade.',
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
  }, [loadAttempt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const savedWindows = await replaceMyAvailability(windows);
      setWindows(savedWindows);
      setNotice('Disponibilidade atualizada.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar sua disponibilidade. Tente novamente.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="availability-manager" aria-labelledby="availability-manager-title">
      <h2 id="availability-manager-title">Sua disponibilidade</h2>
      {isLoading ? (
        <p role="status">Carregando disponibilidade…</p>
      ) : loadError ? (
        <div className="availability-load-error">
          <p role="alert">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError('');
              setIsLoading(true);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <form onSubmit={handleSubmit}>
            <AvailabilityEditor
              disabled={isSaving}
              onChange={(updatedWindows) => {
                setWindows(updatedWindows);
                setError('');
                setNotice('');
              }}
              windows={windows}
            />
            <button className="auth-submit" disabled={isSaving} type="submit">
              {isSaving ? 'Salvando…' : 'Salvar disponibilidade'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}