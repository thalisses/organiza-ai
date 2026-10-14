import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { loadCurrentUserRole, type UserRole } from '../../identity-access/lib/roleManagementService';
import {
  listMaterialPoints,
  type MaterialPoint,
} from '../lib/materialPointService';

const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const weekdays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

type DiscoveryView = 'list' | 'map';

export default function MaterialPointDiscovery() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [points, setPoints] = useState<MaterialPoint[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [view, setView] = useState<DiscoveryView>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
        const materialPoints = await listMaterialPoints();
        if (!isCancelled) {
          setRole(currentRole);
          setPoints(materialPoints);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError('Não foi possível carregar os pontos de material. Tente novamente.');
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

  if (isLoading) {
    return <p role="status">Carregando pontos de material…</p>;
  }
  if (role !== 'participante') {
    return error ? <p className="auth-error" role="alert">{error}</p> : null;
  }

  const searchTerm = search.trim().toLocaleLowerCase('pt-BR');
  const visiblePoints = points.filter((point) => (
    !searchTerm
    || point.materialType.toLocaleLowerCase('pt-BR').includes(searchTerm)
    || point.topic.toLocaleLowerCase('pt-BR').includes(searchTerm)
  ));
  const selectedPoint = visiblePoints.find((point) => point.id === selectedPointId) ?? null;

  return (
    <section className="material-point-discovery" aria-labelledby="material-point-discovery-title">
      <div className="material-point-discovery-heading">
        <h2 id="material-point-discovery-title">Materiais para mobilização</h2>
        <div className="material-point-discovery-views" role="group" aria-label="Visualização dos pontos">
          <button
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            type="button"
          >
            Lista
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

      <label htmlFor="material-point-search">Buscar material ou tema</label>
      <input
        id="material-point-search"
        onChange={(event) => setSearch(event.target.value)}
        type="search"
        value={search}
      />

      {error && <p className="auth-error" role="alert">{error}</p>}
      {visiblePoints.length === 0 ? (
        <p className="material-point-discovery-empty" role="status">
          {points.length === 0 ? 'Nenhum local de retirada cadastrado.' : 'Nenhum ponto corresponde à busca.'}
        </p>
      ) : view === 'list' ? (
        <ul className="material-point-discovery-list">
          {visiblePoints.map((point) => (
            <li key={point.id}>
              <div>
                <h3>{point.name}</h3>
                <p>{point.materialType} · {point.topic}</p>
                <p>{point.address}</p>
              </div>
              <button
                aria-pressed={selectedPointId === point.id}
                onClick={() => setSelectedPointId(point.id)}
                type="button"
              >
                Ver detalhes de {point.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div
          aria-label="Mapa dos locais de retirada"
          className="material-point-discovery-map"
          role="region"
        >
          <MapContainer
            center={[-23.4285, -51.944]}
            className="material-point-discovery-map-canvas"
            maxZoom={18}
            minZoom={9}
            scrollWheelZoom={false}
            zoom={11}
          >
            <TileLayer attribution={tileAttribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visiblePoints.map((point) => (
              <CircleMarker
                center={[point.location.coordinates[1], point.location.coordinates[0]]}
                eventHandlers={{ click: () => setSelectedPointId(point.id) }}
                key={point.id}
                pathOptions={{ color: selectedPointId === point.id ? 'var(--red)' : 'var(--red-3)' }}
                radius={selectedPointId === point.id ? 9 : 7}
              >
                <Popup>
                  <strong>{point.name}</strong>
                  <p>{point.materialType} · {point.topic}</p>
                  <button onClick={() => setSelectedPointId(point.id)} type="button">
                    Ver detalhes
                  </button>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {selectedPoint && (
        <section className="material-point-details" aria-labelledby="selected-material-point-title">
          <h3 id="selected-material-point-title">{selectedPoint.name}</h3>
          <p>{selectedPoint.materialType}</p>
          <p>{selectedPoint.topic}</p>
          <p>{selectedPoint.address}</p>
          <h4>Horários de retirada</h4>
          <ul>
            {selectedPoint.pickupWindows.map((window, index) => (
              <li key={`${selectedPoint.id}-${window.dayOfWeek}-${window.startsAt}-${index}`}>
                {weekdays[window.dayOfWeek]} · {window.startsAt}–{window.endsAt}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
