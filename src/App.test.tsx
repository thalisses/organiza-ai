import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the application name as the main heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Organiza AI' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeTruthy();
  });
});
