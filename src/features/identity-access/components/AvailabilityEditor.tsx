import { useState } from 'react';
import type { AvailabilityWindow } from '../lib/availabilityService';

interface AvailabilityEditorProps {
  windows: readonly AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
  allowMultipleDays?: boolean;
  disabled?: boolean;
}

const weekDays = [
  { value: 1, label: 'Segunda-feira', initial: 'S' },
  { value: 2, label: 'Terça-feira', initial: 'T' },
  { value: 3, label: 'Quarta-feira', initial: 'Q' },
  { value: 4, label: 'Quinta-feira', initial: 'Q' },
  { value: 5, label: 'Sexta-feira', initial: 'S' },
  { value: 6, label: 'Sábado', initial: 'S' },
  { value: 0, label: 'Domingo', initial: 'D' },
] as const;

export default function AvailabilityEditor({
  windows,
  onChange,
  allowMultipleDays = false,
  disabled = false,
}: AvailabilityEditorProps) {
  const [selectedDays, setSelectedDays] = useState<AvailabilityWindow['dayOfWeek'][]>([]);
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');

  const eligibleDays = selectedDays.filter((dayOfWeek) => !windows.some((window) => (
    window.dayOfWeek === dayOfWeek
    && window.startsAt === newStartsAt
    && window.endsAt === newEndsAt
  )));
  const canAddSelectedDays = eligibleDays.length > 0
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(newStartsAt)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(newEndsAt)
    && newEndsAt > newStartsAt;

  function updateWindow(index: number, changes: Partial<AvailabilityWindow>) {
    onChange(windows.map((window, windowIndex) => (
      windowIndex === index ? { ...window, ...changes } : window
    )));
  }

  function addWindow() {
    onChange([
      ...windows,
      { dayOfWeek: 1, startsAt: '', endsAt: '' },
    ]);
  }

  function toggleDay(dayOfWeek: AvailabilityWindow['dayOfWeek']) {
    setSelectedDays((currentDays) => (
      currentDays.includes(dayOfWeek)
        ? currentDays.filter((day) => day !== dayOfWeek)
        : [...currentDays, dayOfWeek]
    ));
  }

  function addSelectedDays() {
    if (!canAddSelectedDays) {
      return;
    }

    onChange([
      ...windows,
      ...eligibleDays.map((dayOfWeek) => ({
        dayOfWeek,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
      })),
    ]);
    setSelectedDays([]);
    setNewStartsAt('');
    setNewEndsAt('');
  }

  function removeWindow(index: number) {
    onChange(windows.filter((_, windowIndex) => windowIndex !== index));
  }

  return (
    <section className="availability-editor" aria-labelledby="availability-title">
      <h3 id="availability-title">Disponibilidade semanal</h3>
      <p id="availability-help">
        Informe os dias e horários recorrentes no fuso de São Paulo.
      </p>

      {windows.length === 0 ? (
        <p className="availability-empty">Nenhum intervalo adicionado.</p>
      ) : (
        <div className="availability-windows">
          {windows.map((window, index) => (
            <fieldset className="availability-window" disabled={disabled} key={index}>
              <legend>Intervalo {index + 1}</legend>
              <label htmlFor={`availability-day-${index}`}>Dia da semana</label>
              <select
                aria-describedby="availability-help"
                id={`availability-day-${index}`}
                onChange={(event) => updateWindow(index, {
                  dayOfWeek: Number(event.target.value) as AvailabilityWindow['dayOfWeek'],
                })}
                required
                value={window.dayOfWeek}
              >
                {weekDays.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>

              <div className="availability-time-fields">
                <div>
                  <label htmlFor={`availability-start-${index}`}>Horário inicial</label>
                  <input
                    aria-describedby="availability-help"
                    id={`availability-start-${index}`}
                    onChange={(event) => updateWindow(index, { startsAt: event.target.value })}
                    required
                    type="time"
                    value={window.startsAt}
                  />
                </div>
                <div>
                  <label htmlFor={`availability-end-${index}`}>Horário final</label>
                  <input
                    aria-describedby="availability-help"
                    id={`availability-end-${index}`}
                    onChange={(event) => updateWindow(index, { endsAt: event.target.value })}
                    required
                    type="time"
                    value={window.endsAt}
                  />
                </div>
              </div>

              <button
                className="availability-remove"
                onClick={() => removeWindow(index)}
                type="button"
              >
                Remover intervalo {index + 1}
              </button>
            </fieldset>
          ))}
        </div>
      )}

      {allowMultipleDays ? (
        <fieldset className="availability-new-window" disabled={disabled}>
          <legend>Novo intervalo</legend>
          <div className="availability-weekdays" role="group" aria-label="Dias da semana">
            {weekDays.map((day) => (
              <button
                aria-label={day.label}
                aria-pressed={selectedDays.includes(day.value)}
                className="availability-weekday"
                key={day.value}
                onClick={() => toggleDay(day.value)}
                title={day.label}
                type="button"
              >
                <span aria-hidden="true">{day.initial}</span>
              </button>
            ))}
          </div>

          <div className="availability-time-fields">
            <div>
              <label htmlFor="availability-new-start">Horário inicial</label>
              <input
                aria-describedby="availability-help"
                id="availability-new-start"
                onChange={(event) => setNewStartsAt(event.target.value)}
                type="time"
                value={newStartsAt}
              />
            </div>
            <div>
              <label htmlFor="availability-new-end">Horário final</label>
              <input
                aria-describedby="availability-help"
                id="availability-new-end"
                onChange={(event) => setNewEndsAt(event.target.value)}
                type="time"
                value={newEndsAt}
              />
            </div>
          </div>

          <button
            className="availability-add"
            disabled={!canAddSelectedDays}
            onClick={addSelectedDays}
            type="button"
          >
            Adicionar intervalo
          </button>
        </fieldset>
      ) : (
        <button
          className="availability-add"
          disabled={disabled}
          onClick={addWindow}
          type="button"
        >
          Adicionar intervalo
        </button>
      )}
    </section>
  );
}