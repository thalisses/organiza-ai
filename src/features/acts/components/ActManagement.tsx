import { useEffect, useState, type FormEvent } from 'react';
import { loadCurrentUserRole, type UserRole } from '../../identity-access/lib/roleManagementService';
import {
  actCategoryLabels,
  cancelAct,
  getActAttendees,
  listActs,
  listManageableActSubdivisions,
  saveAct,
  type Act,
  type ActAttendee,
  type ActCategory,
  type ManageableActSubdivision,
} from '../lib/actService';

const emptyForm = {
  title: '',
  category: 'leaflet_distribution' as ActCategory,
  otherDetail: '',
  startsAt: '',
  meetingAddress: '',
  longitude: '',
  latitude: '',
  scope: 'city' as 'city' | 'subdivision',
  subdivisionId: '',
};

export default function ActManagement() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [subdivisions, setSubdivisions] = useState<ManageableActSubdivision[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cancellingActId, setCancellingActId] = useState<string | null>(null);
  const [expandedRosterActId, setExpandedRosterActId] = useState<string | null>(null);
  const [attendeesByAct, setAttendeesByAct] = useState<Record<string, ActAttendee[]>>({});
  const [loadingRosterActId, setLoadingRosterActId] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState('');
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

        const [currentActs, manageableSubdivisions] = await Promise.all([
          listActs(),
          listManageableActSubdivisions(),
        ]);
        if (!isCancelled) {
          setRole(currentRole);
          setActs(currentActs);
          setSubdivisions(manageableSubdivisions);
          if (currentRole === 'lider_setor') {
            setForm((current) => ({ ...current, scope: 'subdivision' }));
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError('Não foi possível carregar a gestão de atos. Tente novamente.');
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

  async function refreshActs() {
    const currentActs = await listActs();
    setActs(currentActs);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'lider_cidade' && role !== 'lider_setor') {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const startsAt = toSaoPauloIso(form.startsAt);
      if (!startsAt) {
        throw new Error('Data inválida.');
      }
      const actId = await saveAct({
        id: editingAct?.id ?? null,
        title: form.title,
        category: form.category,
        otherDetail: form.category === 'other' ? form.otherDetail : null,
        startsAt,
        longitude: Number(form.longitude),
        latitude: Number(form.latitude),
        meetingAddress: form.meetingAddress,
        subdivisionId: form.scope === 'city' ? null : form.subdivisionId || null,
      });
      await refreshActs();
      setEditingAct(null);
      setForm(role === 'lider_setor' ? { ...emptyForm, scope: 'subdivision' } : emptyForm);
      setNotice(editingAct ? 'Ato atualizado.' : 'Ato publicado.');
      if (!actId) {
        throw new Error('Missing act id.');
      }
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : 'Não foi possível salvar o ato. Verifique os dados e suas permissões.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(act: Act) {
    setEditingAct(act);
    setError('');
    setNotice('');
    setForm({
      title: act.title,
      category: act.category,
      otherDetail: act.otherDetail ?? '',
      startsAt: toSaoPauloDateTimeLocal(act.startsAt),
      meetingAddress: act.meetingAddress,
      longitude: String(act.meetingLocation.coordinates[0]),
      latitude: String(act.meetingLocation.coordinates[1]),
      scope: act.subdivisionId ? 'subdivision' : 'city',
      subdivisionId: act.subdivisionId ?? '',
    });
  }

  async function handleCancel(act: Act) {
    if (act.status === 'cancelled' || !window.confirm(`Cancelar o ato “${act.title}”? Ele continuará visível na agenda.`)) {
      return;
    }

    setCancellingActId(act.id);
    setError('');
    setNotice('');
    try {
      await cancelAct(act.id);
      await refreshActs();
      setNotice('Ato cancelado. Ele continua na agenda.');
    } catch (cancelError) {
      setError(cancelError instanceof Error
        ? cancelError.message
        : 'Não foi possível cancelar o ato. Tente novamente.');
    } finally {
      setCancellingActId(null);
    }
  }

  async function toggleRoster(act: Act) {
    if (expandedRosterActId === act.id) {
      setExpandedRosterActId(null);
      setRosterError('');
      return;
    }

    setExpandedRosterActId(act.id);
    setRosterError('');
    if (Object.prototype.hasOwnProperty.call(attendeesByAct, act.id)) {
      return;
    }

    setLoadingRosterActId(act.id);
    try {
      const attendees = await getActAttendees(act.id);
      setAttendeesByAct((current) => ({ ...current, [act.id]: attendees }));
    } catch (rosterLoadError) {
      setRosterError(rosterLoadError instanceof Error
        ? rosterLoadError.message
        : 'Não foi possível carregar os inscritos deste ato. Verifique suas permissões.');
    } finally {
      setLoadingRosterActId(null);
    }
  }

  if (isLoading) {
    return <p role="status">Carregando gestão de atos…</p>;
  }
  if (role !== 'lider_cidade' && role !== 'lider_setor') {
    return error ? <p className="auth-error" role="alert">{error}</p> : null;
  }

  const canCreateCityAct = role === 'lider_cidade';
  const actSubdivisionOptions = subdivisions.map((subdivision) => (
    <option key={subdivision.id} value={subdivision.id}>
      Região {subdivision.regionNumber}, subdivisão {subdivision.subdivisionNumber}
    </option>
  ));

  return (
    <section className="act-management" aria-labelledby="act-management-title">
      <h2 id="act-management-title">Gestão de atos</h2>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}

      <form className="act-management-form" onSubmit={(event) => void handleSave(event)}>
        <h3>{editingAct ? 'Editar ato' : 'Novo ato'}</h3>
        <label htmlFor="act-title">Título</label>
        <input
          id="act-title"
          maxLength={120}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          required
          value={form.title}
        />

        <label htmlFor="act-category">Categoria</label>
        <select
          id="act-category"
          onChange={(event) => setForm((current) => ({
            ...current,
            category: event.target.value as ActCategory,
            otherDetail: event.target.value === 'other' ? current.otherDetail : '',
          }))}
          value={form.category}
        >
          {Object.entries(actCategoryLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {form.category === 'other' && (
          <>
            <label htmlFor="act-other-detail">Detalhe da categoria</label>
            <input
              id="act-other-detail"
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, otherDetail: event.target.value }))}
              required
              value={form.otherDetail}
            />
          </>
        )}

        <label htmlFor="act-starts-at">Data e horário de início</label>
        <input
          id="act-starts-at"
          onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
          required
          type="datetime-local"
          value={form.startsAt}
        />

        <label htmlFor="act-scope">Escopo do ato</label>
        <select
          id="act-scope"
          disabled={!canCreateCityAct}
          onChange={(event) => setForm((current) => ({
            ...current,
            scope: event.target.value as 'city' | 'subdivision',
            subdivisionId: event.target.value === 'city' ? '' : current.subdivisionId,
          }))}
          value={form.scope}
        >
          {canCreateCityAct && <option value="city">Cidade inteira</option>}
          <option value="subdivision">Subdivisão</option>
        </select>

        {form.scope === 'subdivision' && (
          <>
            <label htmlFor="act-subdivision">Subdivisão</label>
            <select
              id="act-subdivision"
              onChange={(event) => setForm((current) => ({ ...current, subdivisionId: event.target.value }))}
              required
              value={form.subdivisionId}
            >
              <option value="">Selecione uma subdivisão</option>
              {actSubdivisionOptions}
            </select>
          </>
        )}

        <label htmlFor="act-address">Endereço de encontro</label>
        <input
          id="act-address"
          maxLength={240}
          onChange={(event) => setForm((current) => ({ ...current, meetingAddress: event.target.value }))}
          required
          value={form.meetingAddress}
        />

        <div className="act-coordinate-fields">
          <div>
            <label htmlFor="act-longitude">Longitude</label>
            <input
              id="act-longitude"
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
            <label htmlFor="act-latitude">Latitude</label>
            <input
              id="act-latitude"
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

        <div className="act-management-actions">
          <button className="auth-submit" disabled={isSaving} type="submit">
            {isSaving ? 'Salvando…' : editingAct ? 'Salvar alterações' : 'Publicar ato'}
          </button>
          {editingAct && (
            <button
              className="act-secondary-button"
              onClick={() => {
                setEditingAct(null);
                setForm(role === 'lider_setor' ? { ...emptyForm, scope: 'subdivision' } : emptyForm);
              }}
              type="button"
            >
              Descartar edição
            </button>
          )}
        </div>
      </form>

      <div className="act-management-list">
        <h3>Atos de Maringá</h3>
        {acts.length === 0 ? (
          <p>Nenhum ato cadastrado.</p>
        ) : (
          <ul>
            {acts.map((act) => (
              <li key={act.id}>
                <div>
                  <h4>{act.title}</h4>
                  <p>{actCategoryLabels[act.category]}{act.otherDetail ? `: ${act.otherDetail}` : ''}</p>
                  <p>{formatActDate(act.startsAt)} · {act.subdivisionId ? subdivisionLabel(act, subdivisions) : 'Cidade inteira'}</p>
                  <p>{act.meetingAddress}</p>
                  <p className={act.status === 'cancelled' ? 'act-cancelled' : ''}>
                    {act.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                  </p>
                </div>
                {canManageAct(role, act, subdivisions) && (
                  <div className="act-row-actions">
                    {act.status === 'scheduled' && (
                      <>
                        <button type="button" onClick={() => startEditing(act)}>Editar {act.title}</button>
                        <button
                          disabled={cancellingActId !== null}
                          onClick={() => void handleCancel(act)}
                          type="button"
                        >
                          {cancellingActId === act.id ? 'Cancelando…' : `Cancelar ${act.title}`}
                        </button>
                      </>
                    )}
                    <button
                      aria-expanded={expandedRosterActId === act.id}
                      disabled={loadingRosterActId !== null && loadingRosterActId !== act.id}
                      onClick={() => void toggleRoster(act)}
                      type="button"
                    >
                      {loadingRosterActId === act.id
                        ? 'Carregando inscritos…'
                        : expandedRosterActId === act.id
                          ? 'Ocultar inscritos'
                          : `Ver inscritos ${act.title}`}
                    </button>
                    {expandedRosterActId === act.id && (
                      <div className="act-attendee-roster">
                        {rosterError ? (
                          <p className="auth-error" role="alert">{rosterError}</p>
                        ) : loadingRosterActId === act.id ? (
                          <p role="status">Carregando inscritos…</p>
                        ) : (
                          <>
                            <h5>Inscritos ({attendeesByAct[act.id]?.length ?? 0})</h5>
                            {(attendeesByAct[act.id] ?? []).length === 0 ? (
                              <p>Nenhuma inscrição ativa.</p>
                            ) : (
                              <ul>
                                {(attendeesByAct[act.id] ?? []).map((attendee) => (
                                  <li key={attendee.registrationId}>
                                    <span>{attendee.participantName}</span>
                                    <a
                                      href={`https://wa.me/${attendee.whatsappE164.slice(1)}`}
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      WhatsApp
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function toSaoPauloIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toSaoPauloDateTimeLocal(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function formatActDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function subdivisionLabel(act: Act, subdivisions: ManageableActSubdivision[]): string {
  const subdivision = subdivisions.find((entry) => entry.id === act.subdivisionId);
  return subdivision
    ? `Região ${subdivision.regionNumber}, subdivisão ${subdivision.subdivisionNumber}`
    : 'Subdivisão';
}

function canManageAct(
  role: UserRole,
  act: Act,
  subdivisions: ManageableActSubdivision[],
): boolean {
  return role === 'lider_cidade'
    || (role === 'lider_setor'
      && act.subdivisionId !== null
      && subdivisions.some((subdivision) => subdivision.id === act.subdivisionId));
}
