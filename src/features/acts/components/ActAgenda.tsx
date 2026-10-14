import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { loadCurrentUserRole, type UserRole } from '../../identity-access/lib/roleManagementService';
import {
  actCategoryLabels,
  cancelMyActRegistration,
  listActs,
  listMyActiveActIds,
  registerForAct,
  type Act,
} from '../lib/actService';

const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type AgendaView = 'agenda' | 'map';

export default function ActAgenda() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [activeActIds, setActiveActIds] = useState<string[]>([]);
  const [view, setView] = useState<AgendaView>('agenda');
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [pendingActId, setPendingActId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isCancelled = false;

    void loadCurrentUserRole()
      .then(async (currentRole) => {
        if (currentRole !== 'participante') {
          if (!isCancelled) {
            setRole(currentRole);
            setIsLoading(false);
          }
          return;
        }

        const [visibleActs, registrations] = await Promise.all([
          listActs(),
          listMyActiveActIds(),
        ]);
        if (!isCancelled) {
          setRole(currentRole);
          setActs(visibleActs);
          setActiveActIds(registrations);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError('Não foi possível carregar a agenda de atos. Tente novamente.');
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

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function refreshActiveActIds() {
    setActiveActIds(await listMyActiveActIds());
  }

  async function handleRegistration(act: Act) {
    setPendingActId(act.id);
    setError('');
    setNotice('');
    try {
      const changed = await registerForAct(act.id);
      await refreshActiveActIds();
      setNotice(changed ? 'Inscrição realizada.' : 'Você já está inscrito neste ato.');
    } catch (registrationError) {
      setError(registrationError instanceof Error
        ? registrationError.message
        : 'Não foi possível se inscrever neste ato. Tente novamente.');
    } finally {
      setPendingActId(null);
    }
  }

  async function handleCancellation(act: Act) {
    setPendingActId(act.id);
    setError('');
    setNotice('');
    try {
      await cancelMyActRegistration(act.id);
      await refreshActiveActIds();
      setNotice('Inscrição cancelada.');
    } catch (cancellationError) {
      setError(cancellationError instanceof Error
        ? cancellationError.message
        : 'Não foi possível cancelar sua inscrição. Tente novamente.');
    } finally {
      setPendingActId(null);
    }
  }

  if (isLoading || currentTime === null) {
    return <p role="status">Carregando agenda de atos…</p>;
  }
  if (role !== 'participante') {
    return error ? <p className="auth-error" role="alert">{error}</p> : null;
  }

  const visibleActs = acts.filter((act) => act.status === 'cancelled' || new Date(act.startsAt).getTime() > currentTime);
  const registrations = new Set(activeActIds);

  return (
    <section className="act-agenda" aria-labelledby="act-agenda-title">
      <div className="act-agenda-heading">
        <h2 id="act-agenda-title">Agenda de atos</h2>
        <div className="act-agenda-views" role="group" aria-label="Visualização da agenda">
          <button
            aria-pressed={view === 'agenda'}
            onClick={() => setView('agenda')}
            type="button"
          >
            Agenda
          </button>
          <button
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
            type="button"
          >
            Mapa
          </button>
        </div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}

      {view === 'agenda' ? (
        visibleActs.length === 0 ? (
          <p className="act-agenda-empty">Nenhum ato disponível.</p>
        ) : (
          <ul className="act-agenda-list">
            {visibleActs.map((act) => {
              const isRegistered = registrations.has(act.id);
              const canRegister = act.status === 'scheduled' && new Date(act.startsAt).getTime() > currentTime;
              return (
                <li key={act.id}>
                  <div className="act-agenda-details">
                    <h3>{act.title}</h3>
                    <p>{actCategoryLabels[act.category]}{act.otherDetail ? `: ${act.otherDetail}` : ''}</p>
                    <p>{formatActDate(act.startsAt)} · {act.scope === 'city' ? 'Cidade inteira' : 'Subdivisão'}</p>
                    <p>{act.meetingAddress}</p>
                    {act.status === 'cancelled' && <p className="act-cancelled">Cancelado</p>}
                  </div>
                  {canRegister && (
                    <button
                      disabled={pendingActId !== null}
                      onClick={() => void (isRegistered ? handleCancellation(act) : handleRegistration(act))}
                      type="button"
                    >
                      {pendingActId === act.id
                        ? 'Aguarde…'
                        : isRegistered
                          ? `Cancelar inscrição em ${act.title}`
                          : `Inscrever-se em ${act.title}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="act-agenda-map" aria-label="Mapa dos atos">
          <MapContainer
            center={[-23.4285, -51.944]}
            className="act-agenda-map-canvas"
            maxZoom={18}
            minZoom={9}
            scrollWheelZoom={false}
            zoom={11}
          >
            <TileLayer attribution={tileAttribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visibleActs.map((act) => (
              <CircleMarker
                center={[act.meetingLocation.coordinates[1], act.meetingLocation.coordinates[0]]}
                key={act.id}
                pathOptions={{ color: act.status === 'cancelled' ? 'var(--red-3)' : 'var(--red)' }}
                radius={7}
              >
                <Popup>
                  <strong>{act.title}</strong>
                  <p>{actCategoryLabels[act.category]}</p>
                  <p>{formatActDate(act.startsAt)}</p>
                  <p>{act.meetingAddress}</p>
                  {act.status === 'cancelled' && <p>Cancelado</p>}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </section>
  );
}

function formatActDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}
