import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

function getLocalSupabaseVariable(name: string): string {
  const output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
  const line = output.split('\n').find((entry) => entry.startsWith(`${name}=`));
  if (!line) {
    throw new Error(`Supabase local status did not provide ${name}. Start the local Supabase stack first.`);
  }
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, '');
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      TMPDIR: process.env.TMPDIR ?? '',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? getLocalSupabaseVariable('API_URL'),
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY
        ?? getLocalSupabaseVariable('PUBLISHABLE_KEY'),
    },
  },
});
