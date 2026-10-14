import { randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';

const fixture = {
  cityEmail: `playwright-city-${randomUUID()}@example.test`,
  assignedEmail: `playwright-sector-assigned-${randomUUID()}@example.test`,
  unassignedEmail: `playwright-sector-unassigned-${randomUUID()}@example.test`,
  regionSetId: '',
  password: `E2E-${randomUUID()}-Cc7!`,
};

const generatedDefaultSubdivisions: string[] = [];

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

async function signUpAccount(page: Page, email: string, name: string, phone: string): Promise<void> {
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Seu nome').fill(name);
  await page.getByLabel('WhatsApp').fill(phone);
  const newInterval = page.getByRole('group', { name: 'Novo intervalo' });
  await newInterval.getByRole('button', { name: 'Segunda-feira' }).click();
  await newInterval.getByLabel('Horário inicial').fill('09:00');
  await newInterval.getByLabel('Horário final').fill('10:00');
  await newInterval.getByRole('button', { name: 'Adicionar intervalo' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(fixture.password);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByText('Sessão ativa.')).toBeVisible();
}

function futureDateTimeLocal(): string {
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return parts.replace(' ', 'T');
}

async function fillActForm(page: Page, title: string, scope: 'city' | 'subdivision', subdivisionLabel?: string) {
  const actForm = page.getByRole('region', { name: 'Gestão de atos' });
  await actForm.getByLabel('Título').fill(title);
  await actForm.getByLabel('Categoria').selectOption('meeting');
  await actForm.getByLabel('Data e horário de início').fill(futureDateTimeLocal());
  await actForm.getByLabel('Escopo do ato').selectOption(scope);
  if (scope === 'subdivision' && subdivisionLabel) {
    await actForm.getByLabel('Subdivisão').selectOption({ label: subdivisionLabel });
  }
  await actForm.getByLabel('Endereço de encontro').fill('Praça da Catedral, s/n');
  await actForm.getByLabel('Longitude').fill('-51.95');
  await actForm.getByLabel('Latitude').fill('-23.42');
  await actForm.getByRole('button', { name: 'Publicar ato' }).click();
  await page.getByRole('heading', { name: title }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test.afterAll(() => {
  const emails = [fixture.cityEmail, fixture.assignedEmail, fixture.unassignedEmail]
    .map((email) => `'${email}'`)
    .join(', ');
  runLocalSql(`delete from public.act_registrations where act_id in (select id from public.acts where title like 'T16 E2E %');`);
  runLocalSql(`delete from public.acts where title like 'T16 E2E %';`);
  runLocalSql(`delete from public.sector_leader_regions where sector_leader_id in (select id from auth.users where lower(email) in (${emails}));`);
  if (generatedDefaultSubdivisions.length > 0) {
    runLocalSql(`delete from public.subdivisions where id in (${generatedDefaultSubdivisions.map((id) => `'${id}'::uuid`).join(', ')});`);
  }
  runLocalSql(`delete from auth.users where lower(email) in (${emails});`);
});

test('city, assigned sector and unassigned sector leaders receive only allowed act controls', async ({ page }) => {
  await page.goto('/');
  await signUpAccount(page, fixture.cityEmail, 'City Leader E2E', '(44) 99999-6721');
  await expect(page.getByRole('combobox', { name: 'Região do mapa' })).toBeVisible();
  const regionSets = queryLocalRows<{ id: string }>(
    `select id from public.region_sets where city_id = '41152000-0000-4000-8000-000000000001'::uuid and status = 'published';`,
  );
  fixture.regionSetId = regionSets[0]?.id ?? '';
  if (!fixture.regionSetId) {
    throw new Error('The published default map is required for leadership E2E fixtures.');
  }

  const cityLeaders = queryLocalRows<{ id: string }>(
    `select id from public.profiles join auth.users using (id) where lower(email) = lower('${fixture.cityEmail}');`,
  );
  const cityLeaderId = cityLeaders[0]?.id;
  if (!cityLeaderId) {
    throw new Error('The city leader profile is required for leadership E2E fixtures.');
  }
  runLocalSql(`update public.profiles set role = 'lider_cidade' where id = '${cityLeaderId}'::uuid;`);

  for (const regionNumber of [1, 2]) {
    const existingSubdivisions = queryLocalRows<{ count: number }>(
      `select count(*)::integer as count from public.subdivisions as subdivision join public.regions as region on region.id = subdivision.region_id where region.region_set_id = '${fixture.regionSetId}'::uuid and region.region_number = ${regionNumber};`,
    );
    if (existingSubdivisions[0]?.count > 0) {
      continue;
    }
    const generated = queryLocalRows<{ subdivision: { id: string } }>(`with claims as materialized (
      select set_config('request.jwt.claim.sub', '${cityLeaderId}', true)
    )
    select public.create_manual_subdivision(region.id,extensions.st_asgeojson(region.geom,15)::jsonb,'${randomUUID()}'::uuid) as subdivision
    from claims,public.regions region where region.region_set_id='${fixture.regionSetId}'::uuid and region.region_number=${regionNumber};`);
    if (generated[0]?.subdivision.id) generatedDefaultSubdivisions.push(generated[0].subdivision.id);
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gestão de atos' })).toBeVisible();
  await fillActForm(page, 'T16 E2E City Act', 'city');
  await page.getByLabel('Escopo do ato').selectOption('subdivision');
  await page.getByLabel('Subdivisão').selectOption({ label: 'Região 2, subdivisão 1' });
  await page.getByLabel('Título').fill('T16 E2E Region Two Act');
  const actForm = page.getByRole('region', { name: 'Gestão de atos' });
  await actForm.getByLabel('Categoria').selectOption('training');
  await actForm.getByLabel('Data e horário de início').fill(futureDateTimeLocal());
  await actForm.getByLabel('Endereço de encontro').fill('Rua E2E, 20');
  await actForm.getByLabel('Longitude').fill('-51.95');
  await actForm.getByLabel('Latitude').fill('-23.42');
  await actForm.getByRole('button', { name: 'Publicar ato' }).click();
  await page.getByRole('heading', { name: 'T16 E2E Region Two Act' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'T16 E2E Region Two Act' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver inscritos T16 E2E City Act' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
  await signUpAccount(page, fixture.assignedEmail, 'Assigned Sector E2E', '(44) 99999-6722');
  const sectorLeaders = queryLocalRows<{ id: string }>(
    `select id from public.profiles join auth.users using (id) where lower(email) = lower('${fixture.assignedEmail}');`,
  );
  const sectorLeaderId = sectorLeaders[0]?.id;
  if (!sectorLeaderId) {
    throw new Error('The assigned sector leader profile was not created.');
  }
  runLocalSql(`update public.profiles set role = 'lider_setor' where id = '${sectorLeaderId}'::uuid;`);
  runLocalSql(`insert into public.sector_leader_regions (sector_leader_id, region_id, assigned_by)
    select '${sectorLeaderId}'::uuid, region.id, '${cityLeaderId}'::uuid
    from public.regions as region
    where region.region_set_id = '${fixture.regionSetId}'::uuid and region.region_number = 1;`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gestão de atos' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Cidade inteira' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar T16 E2E City Act' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar T16 E2E Region Two Act' })).toHaveCount(0);

  const sectorActForm = page.getByRole('region', { name: 'Gestão de atos' });
  await sectorActForm.getByLabel('Título').fill('T16 E2E Assigned Region Act');
  await sectorActForm.getByLabel('Categoria').selectOption('leaflet_distribution');
  await sectorActForm.getByLabel('Data e horário de início').fill(futureDateTimeLocal());
  await sectorActForm.getByLabel('Subdivisão').selectOption({ label: 'Região 1, subdivisão 1' });
  await sectorActForm.getByLabel('Endereço de encontro').fill('Rua E2E, 10');
  await sectorActForm.getByLabel('Longitude').fill('-51.95');
  await sectorActForm.getByLabel('Latitude').fill('-23.42');
  await sectorActForm.getByRole('button', { name: 'Publicar ato' }).click();
  await page.getByRole('heading', { name: 'T16 E2E Assigned Region Act' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'T16 E2E Assigned Region Act' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver inscritos T16 E2E Assigned Region Act' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver inscritos T16 E2E City Act' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver inscritos T16 E2E Region Two Act' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
  await signUpAccount(page, fixture.unassignedEmail, 'Unassigned Sector E2E', '(44) 99999-6723');
  runLocalSql(`update public.profiles as profile set role = 'lider_setor' from auth.users as auth_user where auth_user.id = profile.id and lower(auth_user.email) = lower('${fixture.unassignedEmail}');`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gestão de atos' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Cidade inteira' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Região 1, subdivisão 1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar T16 E2E Assigned Region Act' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ver inscritos/ })).toHaveCount(0);
});

test('manual subdivisions save on completion and survive reload with overlap', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const accounts=queryLocalRows<{id:string}>(`select id from auth.users where lower(email)=lower('${fixture.cityEmail}');`);
  if(accounts.length===0){
    await signUpAccount(page,fixture.cityEmail,'City Leader E2E','(44) 99999-6721');
    runLocalSql(`update public.profiles set role='lider_cidade' where id in (select id from auth.users where lower(email)=lower('${fixture.cityEmail}'));`);
    fixture.regionSetId=queryLocalRows<{id:string}>(`select id from public.region_sets where city_id='41152000-0000-4000-8000-000000000001'::uuid and status='published';`)[0]?.id ?? '';
    if(!fixture.regionSetId) throw new Error('A published map is required for manual subdivision fixtures.');
    await page.reload();
  } else {
    await page.getByLabel('E-mail').fill(fixture.cityEmail);
    await page.getByLabel('Senha').fill(fixture.password);
    await page.getByRole('button',{name:'Entrar na conta',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:'Nova subregião'})).toBeVisible();
  await page.getByLabel('Região do mapa').selectOption('2');
  const rows=queryLocalRows<{id:string;geometry:{coordinates:number[][][]};total:number}>(`
    select region.id,extensions.st_asgeojson(extensions.st_transform(extensions.st_buffer(
      extensions.st_pointonsurface(extensions.st_transform(region.geom,31982)),20,'quad_segs=1'),4326),15)::jsonb as geometry,
      (select count(*)::integer from public.subdivisions where region_id=region.id) as total
    from public.regions region where region.region_set_id='${fixture.regionSetId}'::uuid and region.region_number=3;`);
  expect(rows).toHaveLength(1);
  const region=rows[0];
  const editor=page.locator('.subdivision-cut-controls');
  await editor.getByRole('button',{name:'Nova subregião'}).click();
  const canvas=page.locator('.city-map-canvas');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  const tileBefore=await page.locator('.city-map-canvas .leaflet-tile').first().getAttribute('src');
  await canvas.click({position:{x:box!.width/2,y:box!.height/2}});
  await expect(editor.getByRole('status')).toContainText('1 pontos');
  await canvas.click({position:{x:box!.width/2+15,y:box!.height/2}});
  await expect(editor.getByRole('status')).toContainText('2 pontos');
  const tileAfter=await page.locator('.city-map-canvas .leaflet-tile').first().getAttribute('src');
  expect(tileAfter?.split('/')[3]).toBe(tileBefore?.split('/')[3]);
  await editor.getByRole('button',{name:'Cancelar desenho'}).click();
  for(let index=0;index<2;index+=1){
    await editor.getByRole('button',{name:'Nova subregião'}).click();
    for(const [longitude,latitude] of region.geometry.coordinates[0].slice(0,-1)){
      await editor.getByLabel('Latitude do ponto').fill(String(latitude));
      await editor.getByLabel('Longitude do ponto').fill(String(longitude));
      await editor.getByRole('button',{name:'Adicionar ponto',exact:true}).press('Enter');
    }
    await editor.getByRole('button',{name:'Concluir e salvar'}).click();
    await expect(editor.getByRole('status')).toHaveText(`Subregiões salvas: ${region.total+index+1} · 0 pontos`);
    const created=queryLocalRows<{id:string}>(`select subdivision.id from public.subdivisions subdivision
      join auth.users auth_user on auth_user.id=subdivision.manual_created_by
      where subdivision.region_id='${region.id}'::uuid and lower(auth_user.email)=lower('${fixture.cityEmail}');`);
    for(const {id} of created) if(!generatedDefaultSubdivisions.includes(id)) generatedDefaultSubdivisions.push(id);
  }
  const requestId=randomUUID();
  const input=JSON.stringify(region.geometry);
  const concurrentSql=`with claims as materialized (
    select set_config('request.jwt.claim.sub',(select id::text from auth.users where lower(email)=lower('${fixture.cityEmail}')),true)
  ) select public.create_manual_subdivision('${region.id}'::uuid,'${input}'::jsonb,'${requestId}'::uuid) as subdivision from claims;`;
  const responses=await Promise.all([0,1].map(()=>promisify(execFile)('supabase',['db','query','--local',concurrentSql],{cwd:process.cwd(),encoding:'utf8'})));
  const concurrentIds=responses.map(response=>(JSON.parse(response.stdout) as {rows:Array<{subdivision:{id:string}}>}).rows[0].subdivision.id);
  generatedDefaultSubdivisions.push(...concurrentIds);
  expect(new Set(concurrentIds).size).toBe(1);
  await page.reload();
  await page.getByLabel('Região do mapa').selectOption('2');
  await expect(editor.getByRole('status')).toHaveText(`Subregiões salvas: ${region.total+3} · 0 pontos`);
  await expect(page.getByRole('button',{name:'Gerar subdivisões'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Publicar mapa'})).toHaveCount(0);
  await page.locator('.city-map-frame').screenshot({path:'test-results/manual-subdivisions-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await editor.screenshot({path:'test-results/manual-subdivisions-mobile.png'});
  const layout=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,
    controls:Array.from(document.querySelectorAll('.subdivision-cut-controls,.subdivision-cut-controls > *,.city-map-frame'))
      .map(element=>({tag:element.tagName,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right})),
  }));
  for(const control of layout.controls){
    expect(control.left,JSON.stringify(control)).toBeGreaterThanOrEqual(0);
    expect(control.right,JSON.stringify(control)).toBeLessThanOrEqual(layout.viewport);
  }
  const browser=page.context().browser();
  if(!browser) throw new Error('Touch verification requires a browser context.');
  const touchContext=await browser.newContext({
    viewport:{width:390,height:844},hasTouch:true,
    storageState:await page.context().storageState(),
  });
  try {
    const touchPage=await touchContext.newPage();
    await touchPage.goto(page.url());
    await touchPage.getByLabel('Região do mapa').selectOption('2');
    const touchEditor=touchPage.locator('.subdivision-cut-controls');
    await touchEditor.getByRole('button',{name:'Nova subregião'}).tap();
    const touchCanvas=touchPage.locator('.city-map-canvas');
    const touchBox=await touchCanvas.boundingBox();
    if(!touchBox) throw new Error('The map must be visible for touch verification.');
    await touchCanvas.tap({position:{x:touchBox.width/2,y:touchBox.height/2}});
    await expect(touchEditor.getByRole('status')).toContainText('1 pontos');
    await touchEditor.getByRole('button',{name:'Cancelar desenho'}).tap();
    await expect(touchEditor.getByRole('status')).toHaveText(`Subregiões salvas: ${region.total+3} · 0 pontos`);
  } finally {
    await touchContext.close();
  }
});
