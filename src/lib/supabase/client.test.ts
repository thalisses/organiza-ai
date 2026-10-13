import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: {} })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  createClientMock.mockClear();
  vi.resetModules();
});

describe('getSupabaseClient', () => {
  it('reports missing public configuration without creating a client', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const { getSupabaseClient } = await import('./client');

    expect(() => getSupabaseClient()).toThrow('Configuração do Supabase ausente.');
  });

  it('creates and reuses a client from the public Vite variables', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-key');
    const { getSupabaseClient } = await import('./client');

    const firstClient = getSupabaseClient();

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test-key',
    );
    expect(getSupabaseClient()).toBe(firstClient);
  });
});
