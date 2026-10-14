import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import AvailabilityEditor from './AvailabilityEditor';
import type { AvailabilityWindow } from '../lib/availabilityService';

function ControlledAvailabilityEditor({
  allowMultipleDays = false,
  initialWindows = [],
}: {
  allowMultipleDays?: boolean;
  initialWindows?: AvailabilityWindow[];
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(initialWindows);
  return (
    <AvailabilityEditor
      allowMultipleDays={allowMultipleDays}
      windows={windows}
      onChange={setWindows}
    />
  );
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

  it('adds one independent interval for each selected weekday', async () => {
    const user = userEvent.setup();
    render(<ControlledAvailabilityEditor allowMultipleDays />);

    const newInterval = screen.getByRole('group', { name: 'Novo intervalo' });
    await user.click(within(newInterval).getByRole('button', { name: 'Segunda-feira' }));
    await user.click(within(newInterval).getByRole('button', { name: 'Quarta-feira' }));
    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '09:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '12:00' },
    });

    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));

    const intervals = screen.getAllByRole('group', { name: /^Intervalo/ });
    expect(intervals.map((interval) => (
      (within(interval).getByLabelText('Dia da semana') as HTMLSelectElement).value
    ))).toEqual(['1', '3']);
    expect(intervals.map((interval) => (
      (within(interval).getByLabelText('Horário inicial') as HTMLInputElement).value
    ))).toEqual(['09:00', '09:00']);
    expect(intervals.map((interval) => (
      (within(interval).getByLabelText('Horário final') as HTMLInputElement).value
    ))).toEqual(['12:00', '12:00']);

    fireEvent.change(within(intervals[0]).getByLabelText('Horário inicial'), {
      target: { value: '10:00' },
    });
    expect((within(intervals[0]).getByLabelText('Horário inicial') as HTMLInputElement).value)
      .toBe('10:00');
    expect((within(intervals[1]).getByLabelText('Horário inicial') as HTMLInputElement).value)
      .toBe('09:00');
    await user.click(within(intervals[0]).getByRole('button', { name: 'Remover intervalo 1' }));
    expect(screen.getAllByRole('group', { name: /^Intervalo/ })).toHaveLength(1);
  });

  it('preserves existing intervals and skips exact duplicates per weekday', async () => {
    const user = userEvent.setup();
    render(
      <ControlledAvailabilityEditor
        allowMultipleDays
        initialWindows={[
          { dayOfWeek: 1, startsAt: '09:00', endsAt: '12:00' },
          { dayOfWeek: 2, startsAt: '14:00', endsAt: '16:00' },
        ]}
      />,
    );

    const newInterval = screen.getByRole('group', { name: 'Novo intervalo' });
    await user.click(within(newInterval).getByRole('button', { name: 'Segunda-feira' }));
    await user.click(within(newInterval).getByRole('button', { name: 'Terça-feira' }));
    await user.click(within(newInterval).getByRole('button', { name: 'Quarta-feira' }));
    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '09:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '12:00' },
    });

    await user.click(screen.getByRole('button', { name: 'Adicionar intervalo' }));

    expect(screen.getAllByLabelText('Dia da semana').map((input) => (
      (input as HTMLSelectElement).value
    ))).toEqual(['1', '2', '2', '3']);
  });

  it('requires at least one weekday and a valid time range before adding', async () => {
    const user = userEvent.setup();
    render(<ControlledAvailabilityEditor allowMultipleDays />);

    const newInterval = screen.getByRole('group', { name: 'Novo intervalo' });
    const addButton = screen.getByRole('button', { name: 'Adicionar intervalo' });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(newInterval).getByLabelText('Horário inicial'), {
      target: { value: '09:00' },
    });
    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '09:00' },
    });
    await user.click(within(newInterval).getByRole('button', { name: 'Segunda-feira' }));
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(newInterval).getByLabelText('Horário final'), {
      target: { value: '10:00' },
    });
    expect((addButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('supports keyboard selection and exposes the selected state', async () => {
    const user = userEvent.setup();
    render(<ControlledAvailabilityEditor allowMultipleDays />);

    await user.tab();
    const mondayButton = screen.getByRole('button', { name: 'Segunda-feira' });
    expect(mondayButton.getAttribute('aria-pressed')).toBe('false');

    await user.keyboard(' ');

    expect(mondayButton.getAttribute('aria-pressed')).toBe('true');
  });
});