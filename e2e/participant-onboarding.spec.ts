import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

let disposableEmail: string | null = null;

test.afterAll(() => {
  if (!disposableEmail) {
    return;
  }

  execFileSync('supabase', [
    'db',
    'query',
    '--local',
    `delete from auth.users where lower(email) = lower('${disposableEmail}');`,
  ], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
});

test('participant can sign up, see personal tools and sign out', async ({ page }) => {
  disposableEmail = `playwright-${randomUUID()}@example.test`;
  const password = `E2E-${randomUUID()}-Aa9!`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Seu nome').fill('Participante Playwright');
  await page.getByLabel('WhatsApp').fill('(44) 99999-6789');
  const newInterval = page.getByRole('group', { name: 'Novo intervalo' });
  await newInterval.getByRole('button', { name: 'Segunda-feira' }).click();
  await newInterval.getByRole('button', { name: 'Quarta-feira' }).click();
  await newInterval.getByLabel('Horário inicial').fill('09:00');
  await newInterval.getByLabel('Horário final').fill('11:00');
  await page.getByRole('button', { name: 'Adicionar intervalo' }).click();
  await page.getByLabel('E-mail').fill(disposableEmail);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  await expect(page.getByText('Sessão ativa.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua disponibilidade' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agenda de atos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Materiais para mobilização' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gestão de atos' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Locais de retirada' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar na conta' })).toBeVisible();
  await page.getByLabel('E-mail').fill(disposableEmail);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar na conta' }).click();
  await expect(page.getByText('Sessão ativa.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua disponibilidade' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Intervalo 1' }).getByLabel('Dia da semana'))
    .toHaveValue('1');
  await expect(page.getByRole('group', { name: 'Intervalo 2' }).getByLabel('Dia da semana'))
    .toHaveValue('3');
  const mondayInterval = page.getByRole('group', { name: 'Intervalo 1' });
  const wednesdayInterval = page.getByRole('group', { name: 'Intervalo 2' });
  await expect(mondayInterval.getByLabel('Horário inicial')).toHaveValue('09:00');
  await expect(wednesdayInterval.getByLabel('Horário final')).toHaveValue('11:00');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { name: 'Agenda de atos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Materiais para mobilização' })).toBeVisible();
  const weekdayButtons = page.getByRole('group', { name: 'Dias da semana' }).getByRole('button');
  const weekdayButtonMetrics = await weekdayButtons.evaluateAll((buttons) => (
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return { width: bounds.width, top: Math.round(bounds.top) };
    })
  ));
  expect(weekdayButtonMetrics).toHaveLength(7);
  expect(weekdayButtonMetrics.every(({ width }) => width >= 44)).toBe(true);
  expect(new Set(weekdayButtonMetrics.map(({ top }) => top)).size).toBeGreaterThan(1);
  const documentWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(320);
  await expect(mondayInterval.getByLabel('Dia da semana')).toHaveValue('1');
  await expect(wednesdayInterval.getByLabel('Dia da semana')).toHaveValue('3');
  await expect(mondayInterval.getByLabel('Horário inicial')).toHaveValue('09:00');
  await expect(wednesdayInterval.getByLabel('Horário final')).toHaveValue('11:00');
});
