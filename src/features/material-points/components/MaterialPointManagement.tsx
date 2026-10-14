import { useEffect, useState, type FormEvent } from 'react';
import AvailabilityEditor from '../../identity-access/components/AvailabilityEditor';
import { loadCurrentUserRole, type UserRole } from '../../identity-access/lib/roleManagementService';
import {
  validateAvailabilityWindows,
  type AvailabilityWindow,
} from '../../identity-access/lib/availabilityService';
import {
  deleteMaterialPoint,
  listMaterialPoints,
  saveMaterialPoint,
  type MaterialPoint,
} from '../lib/materialPointService';

const emptyPoint = {
  name: '',
  materialType: '',
  topic: '',
  address: '',
  longitude: '',
  latitude: '',
};

const weekdays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export default function MaterialPointManagement() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [points, setPoints] = useState<MaterialPoint[]>([]);
  const [form, setForm] = useState(emptyPoint);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [editingPoint, setEditingPoint] = useState<MaterialPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPointId, setDeletingPointId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isCancelled = false;
    void loadCurrentUserRole()
      .then(async (currentRole) => {
        if (currentRole !== 'lider_cidade' && currentRole !== 'lider_setor') {
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
          setError('Não foi possível carregar os locais de retirada. Tente novamente.');
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

  async function refreshPoints() {
    setPoints(await listMaterialPoints());
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'lider_cidade' && role !== 'lider_setor') {
      return;
    }

    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      validateAvailabilityWindows(windows);
      await saveMaterialPoint({
        id: editingPoint?.id ?? null,
        name: form.name,
        materialType: form.materialType,
        topic: form.topic,
        address: form.address,
        longitude: Number(form.longitude),
        latitude: Number(form.latitude),
        pickupWindows: windows,
      });
      await refreshPoints();
      setForm(emptyPoint);
      setWindows([]);
      setEditingPoint(null);
      setNotice(editingPoint ? 'Ponto atualizado.' : 'Ponto cadastrado.');
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : 'Não foi possível salvar o ponto. Verifique os dados e suas permissões.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(point: MaterialPoint) {
    setEditingPoint(point);
    setForm({
      name: point.name,
      materialType: point.materialType,
      topic: point.topic,
      address: point.address,
      longitude: String(point.location.coordinates[0]),
      latitude: String(point.location.coordinates[1]),
    });
    setWindows(point.pickupWindows);
    setError('');
    setNotice('');
  }

  async function handleDelete(point: MaterialPoint) {
    if (!window.confirm(`Excluir o ponto “${point.name}” e seus horários?`)) {
      return;
    }

    setDeletingPointId(point.id);
    setError('');
    setNotice('');
    try {
      await deleteMaterialPoint(point.id);
      await refreshPoints();
      if (editingPoint?.id === point.id) {
        setEditingPoint(null);
        setForm(emptyPoint);
        setWindows([]);
      }
      setNotice('Ponto e horários excluídos.');
    } catch (deleteError) {
      setError(deleteError instanceof Error
        ? deleteError.message
        : 'Não foi possível excluir o ponto. Tente novamente.');
    } finally {
      setDeletingPointId(null);
    }
  }

  if (isLoading) {
    return <p role="status">Carregando locais de retirada…</p>;
  }
  if (role !== 'lider_cidade' && role !== 'lider_setor') {
    return error ? <p className="auth-error" role="alert">{error}</p> : null;
  }

  return (
    <section className="material-point-management" aria-labelledby="material-point-management-title">
      <h2 id="material-point-management-title">Locais de retirada</h2>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}

      <form className="material-point-form" onSubmit={(event) => void handleSave(event)}>
        <h3>{editingPoint ? 'Editar ponto' : 'Novo ponto'}</h3>
        <label htmlFor="material-point-name">Nome do ponto</label>
        <input
          id="material-point-name"
          maxLength={120}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
          value={form.name}
        />

        <label htmlFor="material-point-material">Tipo de material</label>
        <input
          id="material-point-material"
          maxLength={120}
          onChange={(event) => setForm((current) => ({ ...current, materialType: event.target.value }))}
          required
          value={form.materialType}
        />

        <label htmlFor="material-point-topic">Tema</label>
        <input
          id="material-point-topic"
          maxLength={160}
          onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}
          required
          value={form.topic}
        />

        <label htmlFor="material-point-address">Endereço</label>
        <input
          id="material-point-address"
          maxLength={240}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          required
          value={form.address}
        />

        <div className="material-point-coordinate-fields">
          <div>
            <label htmlFor="material-point-longitude">Longitude</label>
            <input
              id="material-point-longitude"
              max="180"
              min="-180"
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
              required
              step="any"
              type="number"
              value={form.longitude}
            />
          </div>
          <div>
            <label htmlFor="material-point-latitude">Latitude</label>
            <input
              id="material-point-latitude"
              max="90"
              min="-90"
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
              required
              step="any"
              type="number"
              value={form.latitude}
            />
          </div>
        </div>

        <AvailabilityEditor windows={windows} onChange={setWindows} />
        <div className="material-point-actions">
          <button className="auth-submit" disabled={isSaving} type="submit">
            {isSaving ? 'Salvando…' : editingPoint ? 'Salvar alterações' : 'Salvar ponto'}
          </button>
          {editingPoint && (
            <button
              className="act-secondary-button"
              onClick={() => {
                setEditingPoint(null);
                setForm(emptyPoint);
                setWindows([]);
              }}
              type="button"
            >
              Descartar edição
            </button>
          )}
        </div>
      </form>

      <div className="material-point-list">
        <h3>Pontos cadastrados</h3>
        {points.length === 0 ? (
          <p>Nenhum ponto cadastrado.</p>
        ) : (
          <ul>
            {points.map((point) => (
              <li key={point.id}>
                <div>
                  <h4>{point.name}</h4>
                  <p>{point.materialType} · {point.topic}</p>
                  <p>{point.address}</p>
                  <ul>
                    {point.pickupWindows.map((window, index) => (
                      <li key={`${point.id}-${window.dayOfWeek}-${window.startsAt}-${index}`}>
                        {weekdays[window.dayOfWeek]} · {window.startsAt}–{window.endsAt}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="material-point-row-actions">
                  <button onClick={() => startEditing(point)} type="button">
                    Editar {point.name}
                  </button>
                  <button
                    disabled={deletingPointId !== null}
                    onClick={() => void handleDelete(point)}
                    type="button"
                  >
                    {deletingPointId === point.id ? 'Excluindo…' : `Excluir ${point.name}`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}