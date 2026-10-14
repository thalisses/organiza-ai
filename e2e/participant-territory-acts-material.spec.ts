import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const fixture = {
  email: `playwright-journey-${randomUUID()}@example.test`,
  regionSetId: '',
  materialPointId: randomUUID(),
  cityActId: randomUUID(),
  subdivisionActId: randomUUID(),
};

let cityLeaderId = '';
let initializedDefaultMap = false;
const createdDefaultSubdivisions: string[] = [];

function runLocalSql(sql: string): void {
  execFileSync('supabase', ['db', 'query', '--local', sql], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

function queryLocalRows<T>(sql: string): T[] {
  const output = execFileSync('supabase', ['db', 'query', '--local', sql], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return (JSON.parse(output) as { rows: T[] }).rows;
}

test.beforeAll(() => {
  const leaders = queryLocalRows<{ id: string }>(
    `select id from public.profiles where city_id = '41152000-0000-4000-8000-000000000001'::uuid and role = 'lider_cidade' order by created_at limit 1;`,
  );
  cityLeaderId = leaders[0]?.id ?? '';
  if (!cityLeaderId) {
    throw new Error('A local city leader is required for territory E2E fixtures.');
  }

  const initializations = queryLocalRows<{
    initialization: { initialized: boolean; regionSetId: string };
  }>(`with city_leader as materialized (
    select id from public.profiles where id = '${cityLeaderId}'::uuid
  ), claims as materialized (
    select set_config('request.jwt.claim.sub', id::text, true) from city_leader
  )
  select public.ensure_maringa_default_regions() as initialization from claims;`);
  fixture.regionSetId = initializations[0]?.initialization.regionSetId ?? '';
  initializedDefaultMap = initializations[0]?.initialization.initialized ?? false;
  if (!fixture.regionSetId) {
    throw new Error('The local city map could not be initialized for territory E2E fixtures.');
  }

  const mapRows = queryLocalRows<{ isSystemDefault: boolean }>(
    `select is_system_default as "isSystemDefault" from public.region_sets where id = '${fixture.regionSetId}'::uuid;`,
  );
  const existingSubdivisionRows = queryLocalRows<{ count: number }>(
    `select count(*)::integer as count from public.subdivisions as subdivision join public.regions as region on region.id = subdivision.region_id where region.region_set_id = '${fixture.regionSetId}'::uuid and region.region_number = 1;`,
  );
  if (existingSubdivisionRows[0]?.count === 0) {
    if (!mapRows[0]?.isSystemDefault) {
      throw new Error('A non-default published map needs subdivisions before territory E2E fixtures can run.');
    }
    for (let index = 0; index < 2; index += 1) {
      const created = queryLocalRows<{ subdivision: { id: string } }>(`with claims as materialized (
        select set_config('request.jwt.claim.sub', '${cityLeaderId}', true)
      ) select public.create_manual_subdivision(region.id,extensions.st_asgeojson(region.geom,15)::jsonb,'${randomUUID()}'::uuid) as subdivision
      from claims,public.regions region where region.region_set_id='${fixture.regionSetId}'::uuid and region.region_number=1;`);
      if (created[0]?.subdivision.id) createdDefaultSubdivisions.push(created[0].subdivision.id);
    }
  }

  const memberSubdivisionRows = queryLocalRows<{ id: string }>(
    `select subdivision.id from public.subdivisions as subdivision join public.regions as region on region.id = subdivision.region_id where region.region_set_id = '${fixture.regionSetId}'::uuid order by region.region_number, subdivision.subdivision_number limit 2;`,
  );
  if (memberSubdivisionRows.length === 0) {
    throw new Error('Territory E2E fixtures require at least one published subdivision.');
  }
  const memberSubdivisionId = memberSubdivisionRows[0].id;
  const actSubdivisionId = memberSubdivisionRows[1]?.id ?? memberSubdivisionId;

  runLocalSql(`insert into public.material_points (
    id, city_id, name, material_type, topic, address, location, created_by, updated_by
  ) values (
    '${fixture.materialPointId}'::uuid,
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Ponto Playwright', 'Panfletos E2E', 'Mobilização E2E', 'Praça da Catedral, s/n',
    (select extensions.st_pointonsurface(extensions.st_unaryunion(extensions.st_collect(geom))) from public.urban_perimeters),
    '${cityLeaderId}'::uuid, '${cityLeaderId}'::uuid
  );`);
  runLocalSql(`insert into public.pickup_windows (material_point_id, day_of_week, starts_at, ends_at)
    values ('${fixture.materialPointId}'::uuid, 1, '09:00', '11:00');`);
  runLocalSql(`insert into public.acts (
    id, city_id, title, category, starts_at, meeting_point, meeting_address,
    subdivision_id, created_by, updated_by
  ) values
    (
      '${fixture.cityActId}'::uuid,
      '41152000-0000-4000-8000-000000000001'::uuid,
      'Ato Playwright Cidade', 'public_rally', now() + interval '1 day',
      (select location from public.material_points where id = '${fixture.materialPointId}'::uuid),
      'Praça da Catedral, s/n', null, '${cityLeaderId}'::uuid, '${cityLeaderId}'::uuid
    ),
    (
      '${fixture.subdivisionActId}'::uuid,
      '41152000-0000-4000-8000-000000000001'::uuid,
      'Ato Playwright Subdivisão', 'training', now() + interval '2 days',
      (select location from public.material_points where id = '${fixture.materialPointId}'::uuid),
      'Rua E2E, 10', '${actSubdivisionId}'::uuid, '${cityLeaderId}'::uuid, '${cityLeaderId}'::uuid
    );`);
});

test.afterAll(() => {
  runLocalSql(`delete from public.act_registrations
    where act_id in ('${fixture.cityActId}'::uuid, '${fixture.subdivisionActId}'::uuid)
      or participant_id in (select id from auth.users where lower(email) = lower('${fixture.email}'));`);
  runLocalSql(`delete from public.subdivision_memberships
    where participant_id in (select id from auth.users where lower(email) = lower('${fixture.email}'));`);
  runLocalSql(`delete from public.region_memberships
    where participant_id in (select id from auth.users where lower(email) = lower('${fixture.email}'));`);
  runLocalSql(`delete from public.acts where id in ('${fixture.cityActId}'::uuid, '${fixture.subdivisionActId}'::uuid);`);
  runLocalSql(`delete from public.pickup_windows where material_point_id = '${fixture.materialPointId}'::uuid;`);
  runLocalSql(`delete from public.material_points where id = '${fixture.materialPointId}'::uuid;`);
  if (createdDefaultSubdivisions.length > 0) {
    runLocalSql(`delete from public.subdivisions where id in (${createdDefaultSubdivisions.map((id) => `'${id}'::uuid`).join(', ')});`);
  }
  if (initializedDefaultMap && fixture.regionSetId) {
    runLocalSql(`delete from public.region_sets where id = '${fixture.regionSetId}'::uuid and is_system_default;`);
  }
  runLocalSql(`delete from auth.users where lower(email) = lower('${fixture.email}');`);
});

test('participant enrolls, discovers acts, and opens material-point details from list and map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Seu nome').fill('Participante Jornada E2E');
  await page.getByLabel('WhatsApp').fill('(44) 99999-6710');
  const newInterval = page.getByRole('group', { name: 'Novo intervalo' });
  await newInterval.getByRole('button', { name: 'Segunda-feira' }).click();
  await newInterval.getByLabel('Horário inicial').fill('09:00');
  await newInterval.getByLabel('Horário final').fill('10:00');
  await newInterval.getByRole('button', { name: 'Adicionar intervalo' }).click();
  await page.getByLabel('E-mail').fill(fixture.email);
  await page.getByLabel('Senha').fill(`E2E-${randomUUID()}-Bb8!`);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByText('Sessão ativa.')).toBeVisible();

  const profileRows = queryLocalRows<{ authUserExists: boolean; profileRole: string | null }>(
    `select exists(select 1 from auth.users where lower(email) = lower('${fixture.email}')) as "authUserExists", (select profile.role from auth.users as auth_user join public.profiles as profile on profile.id = auth_user.id where lower(auth_user.email) = lower('${fixture.email}')) as "profileRole";`,
  );
  expect(profileRows).toEqual([{ authUserExists: true, profileRole: 'participante' }]);

  await expect(page.getByRole('heading', { name: 'Agenda de atos' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Materiais para mobilização' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Inscrição em subdivisão' })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Subdivisão desejada').selectOption({ label: 'Subdivisão 1' });
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await expect(page.getByText('Sua inscrição atual: Região 1, subdivisão 1.')).toBeVisible();

  const regionEnrollment = page.getByRole('region', { name: 'Inscrição em divisões do mapa' });
  await regionEnrollment.getByRole('checkbox').nth(0).check();
  await regionEnrollment.getByRole('checkbox').nth(1).check();
  await regionEnrollment.getByRole('button', { name: 'Salvar inscrições nas divisões' }).click();
  await expect(regionEnrollment.getByText('Suas inscrições nas divisões foram atualizadas.')).toBeVisible();
  const enrollmentRows = queryLocalRows<{
    activeSubdivisionMemberships: number;
    activeRegionMemberships: number;
  }>(`select
    (select count(*)::integer from public.subdivision_memberships
      where participant_id = (select id from auth.users where lower(email) = lower('${fixture.email}'))
        and released_at is null) as "activeSubdivisionMemberships",
    (select count(*)::integer from public.region_memberships
      where participant_id = (select id from auth.users where lower(email) = lower('${fixture.email}'))
        and released_at is null) as "activeRegionMemberships";`);
  expect(enrollmentRows).toEqual([{ activeSubdivisionMemberships: 1, activeRegionMemberships: 2 }]);

  await expect(page.getByRole('heading', { name: 'Ato Playwright Cidade' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ato Playwright Subdivisão' })).toBeVisible();
  await page.getByRole('button', { name: 'Inscrever-se em Ato Playwright Cidade' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar inscrição em Ato Playwright Cidade' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar inscrição em Ato Playwright Cidade' }).click();
  await expect(page.getByRole('button', { name: 'Inscrever-se em Ato Playwright Cidade' })).toBeVisible();

  const discovery = page.getByRole('region', { name: 'Materiais para mobilização' });
  await discovery.getByLabel('Buscar material ou tema').fill('Panfletos E2E');
  await discovery.getByRole('button', { name: 'Ver detalhes de Ponto Playwright' }).click();
  await expect(discovery.getByRole('region', { name: 'Ponto Playwright' })).toBeVisible();
  await expect(discovery.getByText('Mobilização E2E', { exact: true })).toBeVisible();
  await expect(discovery.getByText('Segunda-feira · 09:00–11:00')).toBeVisible();

  await discovery.getByRole('button', { name: 'Mapa' }).click();
  await expect(discovery.getByRole('region', { name: 'Mapa dos locais de retirada' })).toBeVisible();
  await expect(discovery.getByRole('region', { name: 'Ponto Playwright' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ver inscritos/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reservar|Estoque|Confirmar retirada/ })).toHaveCount(0);
});
