import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import AvailabilityEditor from './AvailabilityEditor';
import type { AvailabilityWindow } from '../lib/availabilityService';

function ControlledAvailabilityEditor() {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  return <AvailabilityEditor windows={windows} onChange={setWindows} />;
}

afterEach(cleanup);

describe('AvailabilityEditor', () => {
  it('adds and removes recurring interval rows', async () => {
    const user = userEvent.setup();
    render(<ControlledAvailabilityEditor />);

    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    expect(screen.getAllByLabelText('Dia da semana')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    expect(screen.getAllByLabelText('Dia da semana')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remover intervalo 2' }));
    expect(screen.getAllByLabelText('Dia da semana')).toHaveLength(1);
  });

  it('allows multiple intervals on the same weekday', async () => {
    const user = userEvent.setup();
    render(<ControlledAvailabilityEditor />);
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));

    const dayInputs = screen.getAllByLabelText('Dia da semana');
    await user.selectOptions(dayInputs[0], '1');
    await user.selectOptions(dayInputs[1], '1');
    fireEvent.change(screen.getAllByLabelText('Horário inicial')[0], {
      target: { value: '09:00' },
    });
    fireEvent.change(screen.getAllByLabelText('Horário final')[0], {
      target: { value: '12:00' },
    });
    fireEvent.change(screen.getAllByLabelText('Horário inicial')[1], {
      target: { value: '14:00' },
    });
    fireEvent.change(screen.getAllByLabelText('Horário final')[1], {
      target: { value: '18:00' },
    });

    expect(dayInputs.map((input) => (input as HTMLSelectElement).value)).toEqual(['1', '1']);
    expect(screen.getAllByLabelText('Horário inicial').map((input) => (input as HTMLInputElement).value))
      .toEqual(['09:00', '14:00']);
  });
});