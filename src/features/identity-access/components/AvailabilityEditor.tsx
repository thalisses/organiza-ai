import type { AvailabilityWindow } from '../lib/availabilityService';

interface AvailabilityEditorProps {
  windows: readonly AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
  disabled?: boolean;
}

const weekDays = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
] as const;

export default function AvailabilityEditor({
  windows,
  onChange,
  disabled = false,
}: AvailabilityEditorProps) {
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

      <button
        className="availability-add"
        disabled={disabled}
        onClick={addWindow}
        type="button"
      >
        Adicionar intervalo
      </button>
    </section>
  );
}