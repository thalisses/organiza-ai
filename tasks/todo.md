# Task List: Organiza AI MVP

## Revisão MN: Cadastro Manual Individual

**Status:** especificação e plano aprovados pelo usuário; MN01–MN06 implementadas e verificadas localmente até 2026-10-14. Nove subdivisões automáticas removidas na limpeza autorizada, com as quatro regiões principais preservadas. Gates finais: 133 testes frontend, 417 verificações de banco, 4 jornadas E2E, build e lint passam. Não houve deploy remoto, reset ou commit. Pendências dos outros módulos permanecem intactas.

### MN01: Inventariar áreas e fechar contrato

**Descrição:** conferir registros e referências atuais com consultas somente leitura, classificar a origem sem presunções e definir o contrato de criação/idempotência.
**Aceite:**
- [x] Inventário identificou nove áreas que coincidiam com o gerador anterior; inscrições, histórico de realinhamento e atos estavam vazios antes da limpeza. Origem explícita foi adicionada, sem classificar desconhecidas por presunção.
- [x] RPC `create_manual_subdivision` e campos de origem/chave/autor/hash garantem criação canônica, retry protegido e numeração sob lock.
- [x] Limpeza conservadora interrompe diante de origem/referência incompatível; preservação de manuais e regiões tem cobertura de banco.
**Verificação:** consultas locais somente leitura; conferir migrations e documentação oficial; registrar evidências sem dados pessoais/credenciais.
**Dependências:** aprovação deste plano/tarefas.
**Arquivos prováveis:** `tasks/plan.md`, `SPEC-territory-map.md` apenas se necessário esclarecer contrato.
**Escopo:** pequeno, até 2 arquivos.

### MN02: Criar uma subdivisão manual no banco

**Descrição:** implementar RPC e serviço tipado que validam/recortam um polígono e inserem uma única área disponível no mapa vigente.
**Aceite:**
- [x] Somente liderança autorizada insere; sobreposição, áreas desiguais e cobertura parcial são aceitas, e recorte inválido/vazio falha atomicamente.
- [x] ID/número/geometria canônicos são retornados; retries iguais não duplicam, chave reutilizada com outra entrada falha; duas chamadas concorrentes com a mesma chave retornam o mesmo ID.
- [x] Inserção preserva regiões, mapa, inscrições e áreas anteriores; nenhuma gravação exige rascunho/publicação separados.
**Verificação:** `npm run test:db`; `npm run test -- --run src/features/territory-map/lib/territoryService.test.ts`; `npm run typecheck`.
**Dependências:** MN01.
**Arquivos prováveis:** migração nova, teste SQL focado, `territoryService.ts`, `territoryService.test.ts`.
**Escopo:** médio, até 4 arquivos.

### MN03: Concluir o desenho com salvamento imediato

**Descrição:** conectar o editor à criação individual, mantendo pontos/zoom, exibição temporária e resposta canônica sem replay de toda a partição.
**Aceite:**
- [x] Concluir a primeira área grava e mostra o resultado; a segunda preserva a primeira e pode se sobrepor.
- [x] Estado pendente impede duplo envio; falha mantém pontos/chave para retry e não anuncia sucesso; cancelar/remove ponto atua só antes da gravação.
- [x] Reload lê registros salvos; troca de região preserva os limites do cadastro; cancelar não exclui área salva.
**Verificação:** `npm run test -- --run src/features/territory-map`; `npm run build`; navegador local com cadastro em fixture descartável.
**Dependências:** MN02.
**Arquivos prováveis:** `SubdivisionCutEditor.tsx`, `SubdivisionCutEditor.test.tsx`, `CityMap.tsx`, `CityMap.test.tsx`, `src/styles.css` somente se necessário.
**Escopo:** médio, até 5 arquivos.

### Checkpoint MN: Cadastro Individual
- [x] Primeira e segunda área salvas/disponíveis após commit da transação e reload; sobreposição e cobertura parcial funcionam.
- [x] Falhas/retries/concorrência/autorização testados, sem alteração das regiões principais.

### MN04: Retirar geração e limpar áreas automáticas

**Descrição:** executar a limpeza idempotente baseada no inventário e impedir recriação por todos os endpoints acessíveis; remover os controles de geração de subdivisões.
**Aceite:**
- [x] Removidas nove áreas automáticas de todas as regiões; regiões principais preservadas, e preservação de manuais verificada em fixtures.
- [x] Referências inesperadas interrompem a limpeza sem exclusão parcial/cascata; repetição da operação não remove novos cadastros manuais.
- [x] UI e chamadas diretas deixam de gerar subdivisões automaticamente; geração de regiões principais e bootstrap idempotente preservados.
**Verificação:** `npm run test:db`; `npm run test -- --run src/features/territory-map/components/CityMap.test.tsx`; `npm run build`; conferência de contagens/IDs antes e depois.
**Dependências:** MN01 e checkpoint MN de cadastro individual; limpeza só quando novo cadastro estiver verificado.
**Arquivos prováveis:** migração nova, teste SQL focado, `CityMap.tsx`, `CityMap.test.tsx`, `territoryService.ts`.
**Escopo:** médio, até 5 arquivos.

### MN05: Verificar leitura, inscrição e acessibilidade

**Descrição:** conferir contratos de leitura com zero/uma/várias áreas e numeração após limpeza; garantir disponibilidade para participantes e controles acessíveis.
**Aceite:**
- [x] Participante lê e se inscreve na área manual pelo ID; uma inscrição ativa continua obrigatória (banco e E2E).
- [x] Leitores aceitam regiões vazias e números válidos com lacunas; publicação de região principal sem subáreas tem regressões SQL e UI.
- [x] Mouse, teclado e toque emulado verificados; capturas e limites do editor em desktop/mobile conferidos. Cadastro disponível sem restrição DEV. Teste com dispositivo físico/leitor de tela não executado.
**Verificação:** `npm run test -- --run src/features/territory-map`; `npm run test:db`; `npm run build`; `npm run lint`; navegador com screenshots e inspeção de console.
**Dependências:** MN04.
**Arquivos prováveis:** `territoryService.ts`, `territoryService.test.ts`, `CityMap.tsx`, `CityMap.test.tsx`, `src/styles.css` se necessário. Se uma regra de banco adicional aparecer, tratar em fatia própria sem exceder 5 arquivos.
**Escopo:** médio, até 5 arquivos.

### Checkpoint MN: Manual Exclusivo
- [x] Consulta local final confirmou quatro regiões publicadas e zero subdivisões automáticas/desconhecidas; fixtures manuais foram limpas após testes.
- [x] Fluxo disponível fora de DEV, com criação, limpeza e gates verificados.

### MN06: Jornadas E2E e documentação final

**Descrição:** automatizar cadastro individual e inscrição imediata com fixtures descartáveis; registrar verificações e limites reais.
**Aceite:**
- [x] Jornadas de liderança/participante cobrem cadastro, disponibilidade, inscrição e reload; áreas sobrepostas e IDs preservados.
- [x] Limpeza idempotente, bloqueio da geração, rejeição geométrica e permissões têm cobertura; cancelar não exclui área já salva.
- [x] Gates completos passaram; mouse/teclado/toque emulado e layout do editor verificados. Overflow global de blocos existentes fora do mapa permanece documentado, sem enfraquecer verificações do editor.
**Verificação:** `npm run test -- --run`; `npm run build`; `npm run lint`; `npm run test:db`; `npm run test:e2e`; navegador real.
**Dependências:** MN05 e checkpoint manual exclusivo.
**Arquivos prováveis:** E2E territorial existente ou arquivo focado se necessário, `SPEC-territory-map.md`, `tasks/plan.md`, `tasks/todo.md`.
**Escopo:** médio, até 4 arquivos.

### Checkpoint MN: Aceite
- [x] Critérios funcionais da revisão verificados; advisor local de segurança sem erros e histórico local de migrações sincronizado.
- [x] Nenhum reset, deploy, commit ou exclusão fora do inventário autorizado.

<details>
<summary>Histórico SC: tarefas da prévia (SC04–SC07 substituídas, não concluídas)</summary>

## Histórico SC: Cortes Manuais de Subdivisões

**Status:** plano e tarefas aprovados em 2026-10-13. Política de atos confirmada; SC01 e SC02 concluídas, SC03 entregue como prévia de desenvolvimento. Checkpoint de prévia aguarda revisão antes de SC04; SC04–SC07 não iniciadas. Complementam T08/T09/T10 sem encerrar ou sobrescrever pendências do MVP.

### SC01: Provar cortes e fechar contratos

**Descrição:** validar a viabilidade de uma linha separar GT UEM e áreas sintéticas em exatamente duas partes usando PostGIS; conferir a coleta de linhas no Geoman instalado e inventariar referências às subdivisões. Não alterar dados publicados.

**Aceite:**
- [x] Corte reto/com segmentos e cortes sucessivos preservam cobertura; cortes inválidos, buracos e multipartes têm resultados definidos (18 testes pgTAP passam).
- [x] Contratos de prévia, rascunho, tokens e publicação descrevem autorização, limites e erros; snap visual de 20 px e teto independente de 1 metro no servidor, com teste negativo.
- [x] Política de retenção de IDs/histórico e vínculos de atos é apresentada para revisão; bloqueio de publicação com atos aprovado pelo usuário, sem remoção ou movimentação automática.

**Verificação:** `supabase test db --local supabase/tests/territory_subdivision_cut_feasibility.test_test.sql` passou com 18 testes e rollback. Documentação oficial e tipos instalados conferidos. Nenhuma RPC ou UI de corte implementada ainda.
**Dependências:** aprovação do plano e tarefas.
**Arquivos prováveis:** `tasks/plan.md`, `SPEC-territory-map.md`, teste espacial em `supabase/tests/` se houver prova reutilizável.
**Escopo:** pequeno, até 3 arquivos.

### SC02: Prévia validada no servidor

**Descrição:** adicionar operação sem escrita que calcula o corte e um serviço tipado que verifica sua resposta, sem depender da função existente de edição de vértices.

**Aceite:**
- [x] Liderança recebe duas áreas válidas com métricas; papel não autorizado e entrada adulterada são rejeitados.
- [x] Erro não altera a base; extremos são ajustados somente pela regra acordada e resultados fora da região são negados.
- [x] Contrato distingue ID persistido e referência temporária; limites de 50 áreas/entrada/vértices são efetivos.

**Verificação:** `npm run test:db`; `npm run test -- --run src/features/territory-map/lib/territoryService.test.ts`; `npm run typecheck`.
**Dependências:** SC01 e revisão de seus contratos.
**Arquivos prováveis:** nova migração gerada pelo CLI, teste SQL, `territoryService.ts`, `territoryService.test.ts`.
**Escopo:** médio, até 4 arquivos.

### SC03: Desenhar e desfazer na região selecionada

**Descrição:** conectar a prévia aos controles da região selecionada; coletar pontos, concluir, remover ponto, cancelar e desfazer, mantendo edição local separada do mapa publicado.

**Aceite:**
- [x] GT UEM sem subdivisões e uma subdivisão automática aceitam cortes por pontos; três cortes podem resultar em quatro áreas (prova e RPC; navegador testou cortar base automática existente).
- [x] Área-alvo e resultados são claros; desfazer restaura a prévia anterior; navegação do mapa não desenha cortes acidentalmente (captura por cliques coberta em componente; verificação real de mouse/toque permanece em SC06/SC07).
- [x] Áreas desiguais são aceitas e métricas são informativas; nenhuma chamada de salvar/publicar ocorre apenas ao concluir o corte.

**Verificação:** `npm run test -- --run src/features/territory-map/components/CityMap.test.tsx`; `npm run build`; inspeção do navegador desktop.
**Dependências:** SC02.
**Arquivos prováveis:** `CityMap.tsx`, `CityMap.test.tsx`, componente de coleta de linhas e seu teste somente se necessário, `src/styles.css`.
**Escopo:** médio, até 5 arquivos.

### Checkpoint SC: Prévia
- [x] Nova regra aprovada: área manual fechada pode sobrepor subáreas existentes; resultado é recortado pela região selecionada. Contorno de 18 pontos concluído e desfeito no navegador sem escrita.
- [x] Corte e desfazer funcionam; banco/mapa vigente/inscrições não são alterados.
- [x] Atualização de escopo: corte inicial da região inteira pode substituir as áreas automáticas após confirmação; cruzamento das bordas internas e restauração por desfazer verificados no banco e no navegador.
- [ ] Rever contratos, tolerâncias e referências antes de começar o armazenamento.
- [x] Gates desta fatia: 121 testes frontend, 382 testes de banco, build e lint passaram. E2E de persistência/publicação e testes reais de mouse/toque/mobile continuam pendentes.

### SC04: Salvar e retomar rascunho regional

**Descrição:** guardar a partição manual em rascunho privado, comprovando a sequência de cortes, e permitir retomar após recarregar, sem publicação implícita.

**Aceite:**
- [ ] Salvar/recarregar restaura geometrias e IDs canônicos; o participante continua vendo a configuração publicada anterior.
- [ ] Replay valida a origem manual; áreas desiguais são aceitas; token obsoleto e entrada inválida falham atomicamente.
- [ ] Erro mantém desenho local e estado persistido; outras regiões e áreas não cortadas são preservadas.

**Verificação:** `npm run test:db`; `npm run test -- --run src/features/territory-map`; `npm run build`.
**Dependências:** SC03 e checkpoint de prévia.
**Arquivos prováveis:** migração, teste SQL, `territoryService.ts`, `territoryService.test.ts`, `CityMap.tsx`.
**Escopo:** médio, até 5 arquivos; testes UI adicionais usam a etapa SC06.

### SC05: Publicar sem perder inscrições ou referências

**Descrição:** promover o rascunho em ação explícita e transacional, com validação espacial, origem manual e destinos explícitos para inscrições afetadas, respeitando as decisões de SC01.

**Aceite:**
- [ ] Publicação manual permite desigualdade sem relaxar geração automática; região KML mantém contorno e demais áreas/IDs.
- [ ] Omissão de destinos, referência não tratada, conflito ou falha mantém mapa, inscrições e histórico anteriores; nunca excluir vínculos de atos silenciosamente.
- [ ] Somente liderança da cidade publica; cliente usa resultado canônico e não anuncia sucesso antes de confirmação.

**Verificação:** `npm run test:db`; `npm run test -- --run src/features/territory-map/lib/territoryService.test.ts`; `npm run build`.
**Dependências:** SC04 e aprovação de eventual regra adicional de referências em SC01.
**Arquivos prováveis:** migração, teste SQL, `territoryService.ts`, `territoryService.test.ts`, `CityMap.tsx`.
**Escopo:** médio, até 5 arquivos.

### Checkpoint SC: Persistência
- [ ] Salvar não publica; publicação/reload e realocação funcionam com rollback e conflitos testados.
- [ ] Fluxos automáticos e edição de vértices existentes continuam passando.

### SC06: Acessibilidade e regressões da interface

**Descrição:** concluir teclado, toque, foco, mensagens e proteção contra descarte/substituição, cobrindo o fluxo salvo/publicado nos testes de componentes existentes.

**Aceite:**
- [ ] Controles e meio equivalente de definir pontos são acessíveis por teclado e toque; interface não depende só de cor.
- [ ] Troca de região/modo e geração sobre trabalho existente não descartam edições sem confirmação.
- [ ] Quantidade manual, carregamento, bloqueios e erros não usam as premissas de quantidade fixa da geração automática.

**Verificação:** `npm run test -- --run src/features/territory-map`; `npm run lint`; `npm run build`; navegador desktop/mobile com screenshots e inspeção de console.
**Dependências:** SC05.
**Arquivos prováveis:** `CityMap.tsx`, `CityMap.test.tsx`, componente de coleta e seu teste se criados, `src/styles.css`.
**Escopo:** médio, até 5 arquivos.

### SC07: Jornadas E2E e aceite final

**Descrição:** verificar jornadas reais de liderança/participante com fixtures descartáveis e atualizar documentação do que foi efetivamente comprovado.

**Aceite:**
- [ ] Desenhar três cortes, desfazer, salvar, recarregar e publicar em GT UEM funciona; áreas desiguais persistem.
- [ ] Corte sobre base automática, rejeição de corte inválido, permissões e realocação têm cobertura; mapa publicado não muda durante a prévia/salvamento.
- [ ] Gates gerais passam ou bloqueios são registrados sem apagar testes; controles e tiles renderizam em desktop/mobile.

**Verificação:** `npm run test -- --run`; `npm run build`; `npm run lint`; `npm run test:db`; `npm run test:e2e`; navegador real.
**Dependências:** SC06 e checkpoint de persistência.
**Arquivos prováveis:** teste E2E territorial existente ou novo arquivo focado se necessário, `SPEC-territory-map.md`, `tasks/plan.md`, `tasks/todo.md`.
**Escopo:** médio, até 4 arquivos.

### Checkpoint SC: Concluído
- [ ] Critérios da extensão aprovados e verificados; revisões de segurança e regressão registradas.
- [ ] Dados existentes preservados; nenhum reset, deploy, commit ou dependência nova sem autorização correspondente.

</details>

## Task T01: Obtain and validate the urban-perimeter geometry (in progress; official seven-polygon layer selected)

**Description:** Obtain Maringá's current legal urban-perimeter polygon from the Prefeitura, convert only with an approved source/CRS, and document attribution and CRS. Do not substitute the IBGE municipal perimeter. If the official polygon cannot be obtained or validated, stop the territory-dependent tasks and request a decision.

**Status note (2026-10-12):** O usuário solicitou usar o perímetro urbano oficial completo no MVP. As sete feições do pacote da Prefeitura de 20/07/2026 foram convertidas para GeoJSON EPSG:4326 e integradas ao mapa local T07; T08 pode iniciar a prova técnica com essa fonte. Licença/atribuição, campo `ULT_LEI`, conferência manual GIS e a divergência do Projeto Reviver seguem registradas em `docs/geo-data.md` antes de preview público.

**Acceptance criteria:**
- [ ] The source is the current legal urban perimeter and its provenance/license are documented.
- [x] The selected Distrito Sede geometry is valid, source/project CRSs are known, and the project copy is GeoJSON suitable for the agreed PostGIS/Leaflet flow.
- [x] No map partition is built from an unverified or rural-inclusive substitute.

**Verification:**
- [ ] Manual GIS check with the Prefeitura's legal map: load the official source and converted GeoJSON, verify legal urban extent and CRS.
- [x] Record geometry validity and approximate area in the data-source note.
- [ ] No app build applies to this data-readiness task.

**Dependencies:** None.

**Files likely touched:**
- `src/data/maringa-urban-boundary.geojson`
- `docs/geo-data.md`

**Estimated scope:** Small.

## Task T02a: Configure and lock the application toolchain (completed)

**Description:** Add the approved React/Vite/TypeScript/Supabase stack and test/lint scripts. Use the verified Geoman plugin with React Leaflet and Leaflet. Pin versions, review package provenance, and establish a fail-closed npm lifecycle-script policy before installing dependencies.

**Acceptance criteria:**
- [x] `package.json` and `package-lock.json` pin exact versions: Node 24.21 LTS, React/React DOM 19.3.0, TypeScript 5.9.3, Vite 6.4.4, Supabase JS 2.117.3, Leaflet 1.9.4, React Leaflet 5.0.0, Geoman 2.20.2, React Vite plugin 4.7.0, Vitest 4.1.11, ESLint 10.12.0, and jsdom 30.1.2; other test/lint dependencies are pinned too.
- [x] `.npmrc` sets `ignore-scripts=true` and `engine-strict=true`; scripts are defined for `dev`, `build`, `typecheck`, `test`, and `lint`. E2E script/config is added with T16.
- [x] Geoman's MIT license and peer ranges are documented; no unapproved dependency is added. The esbuild lifecycle source is reviewed and its postinstall remains blocked unless a specific need is demonstrated.

**Verification:**
- [x] `npm ci --ignore-scripts` completes from the generated lockfile under Node 24.
- [x] `npm audit --audit-level=high` reports no unmitigated reachable high/critical issue.

**Dependencies:** None; may proceed in parallel with T01.

**Files likely touched:**
- `.npmrc`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`

**Estimated scope:** Medium.

## Task T02b: Create the runnable React shell (completed)

**Description:** Add the Vite entry point, ESLint flat config, and minimal Portuguese app shell so the repository builds and the test runner has a smoke test before feature work begins.

**Acceptance criteria:**
- [x] The app mounts from the Vite entry point and displays the initial application shell.
- [x] The shell test verifies a nonblank render.
- [x] No credentials or real Supabase keys are embedded in source.

**Verification:**
- [x] `npm run test -- --run src/App.test.tsx` passes.
- [x] `npm run build` succeeds.
- [x] Manual check: `npm run dev` opens the shell in a browser with no console errors.

**Dependencies:** T02a.

**Files likely touched:**
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.test.tsx`
- `eslint.config.js`

**Estimated scope:** Small.

### Checkpoint: Toolchain
- [ ] T01 boundary provenance/CRS is recorded or explicitly blocked pending Prefeitura data.
- [ ] `npm run test -- --run` and `npm run build` pass.
- [ ] Review selected map-editing plugin and package changes before feature implementation.

## Task T03: Create identity schema and baseline RLS (completed)

**Description:** Configure local Supabase development and add the city/profile schema for Maringá, server-controlled roles, the pilot-city record, baseline RLS, explicit Data API grants, and an `npm run test:db` wrapper. The signup trigger always creates participants and ignores client role/city metadata; trusted leader assignment is implemented in T06.

**Acceptance criteria:**
- [x] Public signup trigger can only produce a `participante` profile for the seeded pilot city Maringá and ignores client-supplied role/city metadata.
- [x] No public table privilege or policy allows a participant to elevate their role or change their city; trusted leader assignment is handled in T06.
- [x] Exposed profile/city tables have explicit minimum `GRANT`s and RLS; local config disables automatic Data API grants; anonymous access and participant privilege escalation are denied.
- [x] `npm run test:db` invokes the local pgTAP command confirmed from the installed Supabase CLI help.

**Verification:**
- [x] `npm run test:db` covers schema, grants, anonymous denial, participant ownership, and protected role/city fields.
- [x] `npm run build` succeeds.
- [x] Manual check: `supabase db reset --local --no-seed` applies the migration on the local Supabase instance.

**Dependencies:** T02a, T02b.

**Files likely touched:**
- `supabase/config.toml`
- `supabase/migrations/<identity-schema>.sql`
- `supabase/tests/identity_profile_rls.test_test.sql`
- `package.json`

**Estimated scope:** Medium.

## Task T04a: Add environment protection and tested Supabase client (completed)

**Description:** Add the root ignore rules and placeholder-only environment example, and initialize a lazy Supabase client from Vite public variables.

**Acceptance criteria:**
- [x] `.gitignore` excludes real `.env*` files and local Supabase temp data while `.env.example` contains only placeholder values.
- [x] Supabase client does not initialize until first use, reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and reports missing config without exposing secrets.
**Verification:**
- [x] `npm run test -- --run src/lib/supabase/client.test.ts` verifies missing config and singleton client initialization.
- [x] `npm run typecheck` and `npm run lint` pass.
- [x] Manual check: inspect `.env.example` for placeholders only and confirm no real credentials are tracked.

**Dependencies:** T03.

**Files likely touched:**
- `.gitignore`
- `.env.example`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/client.test.ts`

**Estimated scope:** Medium.

## Task T04b: Implement tested signup/login service (completed)

**Description:** Implement Supabase Auth signup, sign-in, and sign-out service functions. Normalize WhatsApp to E.164 and send only name and phone metadata; the database trigger controls city and participant role. Convert Auth failures to generic user-facing errors and do not log secrets.

**Acceptance criteria:**
- [x] Signup trims name/email, normalizes Brazilian WhatsApp, and never sends role/city metadata.
- [x] Sign-in and sign-out use Supabase Auth; error messages do not leak provider details.
- [x] Service rejects malformed required data before making Auth requests.

**Verification:**
- [x] `npm run test -- --run src/features/identity-access/lib/authService.test.ts` covers signup metadata, E.164 normalization, invalid input, sign-in, sign-out, and generic failures.
- [x] `npm run typecheck` and `npm run lint` pass.
- [x] Manual check: verify Auth service calls contain no role/city fields.

**Dependencies:** T04a.

**Files likely touched:**
- `src/features/identity-access/lib/authService.ts`
- `src/features/identity-access/lib/authService.test.ts`

**Estimated scope:** Small.

## Task T04c: Deliver accessible participant signup/login UI (completed)

**Description:** Connect the React shell to signup/login forms for the single-city Maringá pilot, with accessible name, WhatsApp, email, and password fields and clear pending/success/error states. Do not add email confirmation or password recovery.

**Acceptance criteria:**
- [x] Participants can switch between signup and login; signup requires name, WhatsApp, email, and password.
- [x] Inputs have visible labels, keyboard navigation, and accessible inline/server error feedback; city and role are not public signup controls.
- [x] Auth session state, including a restored session, and logout state are reflected through Supabase Auth APIs/events; application code does not read tokens directly from browser storage.

**Verification:**
- [x] `npm run test -- --run src/features/identity-access/components/AuthForm.test.tsx` passes mode-switch, validation, pending, success, and error states.
- [x] `npm run build` succeeds.
- [x] Local Supabase smoke: sign up, sign in, sign out, and reload without restoring a session; pgTAP denies participant role updates and preserves the participant role.

**Dependencies:** T04b.

**Files likely touched:**
- `src/App.tsx`
- `src/features/identity-access/components/AuthForm.tsx`
- `src/features/identity-access/components/AuthForm.test.tsx`
- `src/styles.css`

**Estimated scope:** Medium.

## Task T05: Deliver required weekly availability (completed)

**Description:** Add required participant availability to signup/profile using recurring weekdays and one or more time intervals per day in `America/Sao_Paulo`.

**Acceptance criteria:**
- [x] Signup is rejected without at least one valid interval; multiple intervals on a weekday can be saved.
- [x] Participants can read and edit only their own availability.
- [x] Leaders can query availability without receiving unauthorized profile fields.

**Verification:**
- [x] `npm run test -- --run` passes validation, Auth UI, schedule editing, and service cases (31 tests).
- [x] `npm run test:db` passes ownership, leader-read, function-grant, and database-validation cases (47 assertions).
- [x] Local Supabase smoke: sign up with two windows on Monday, edit one after login, and verify both persisted after reload.

**Dependencies:** T04c.

**Files likely touched:**
- `supabase/migrations/20261012213051_identity_availability.sql`
- `supabase/tests/identity_availability_rls.test_test.sql`
- `src/features/identity-access/components/AvailabilityEditor.tsx`
- `src/features/identity-access/components/AvailabilityManager.tsx`
- `src/features/identity-access/lib/availabilityService.ts`
- `src/features/identity-access/lib/availabilityService.test.ts`

**Estimated scope:** Medium.

## Task T06: Deliver trusted leadership assignment (completed)

**Description:** Provide the city-leader workflow to assign/remove `lider_setor` and document how the trusted team bootstraps the first city leader. Roles remain protected by RLS.

**Acceptance criteria:**
- [x] Only the city leader can assign/remove sector-leader roles through the application.
- [x] A sector leader cannot assign roles or promote themself.
- [x] Initial city-leader provisioning uses a trusted administrative procedure, not public signup.

**Verification:**
- [x] `npm run test -- --run` passes role-management and identity tests (38 tests total).
- [x] `npm run test:db` denies participant and sector-leader role changes and allows city-leader assignment/removal (63 assertions).
- [x] Local smoke: provision a disposable city leader with the trusted procedure, assign/remove a sector leader in the UI, then delete both test accounts.

**Dependencies:** T04c, T05.

**Files likely touched:**
- `src/features/identity-access/components/SectorLeaderManagement.tsx`
- `src/features/identity-access/components/SectorLeaderManagement.test.tsx`
- `src/features/identity-access/lib/roleManagementService.ts`
- `src/features/identity-access/lib/roleManagementService.test.ts`
- `supabase/migrations/20261012214929_identity_role_management.sql`
- `supabase/tests/identity_role_assignment.test_test.sql`
- `docs/leader-bootstrap.md`

**Estimated scope:** Medium.

### Checkpoint: Identity
- [x] Signup, login, profile availability, and leader assignment work end-to-end.
- [x] Identity/availability/role RLS tests pass and profile/WhatsApp visibility matches the approved spec.
- [ ] Review before territory work.

## Task T07: Load the boundary and render the city map (completed locally; publication checks pending)

**Description:** Persist the validated official urban perimeter and render an interactive Maringá map with OSM tiles, attribution, and the approved boundary. The map is initially read-only.

**Acceptance criteria:**
- [x] The map uses all seven polygons from the official urban-perimeter layer and renders without geometry errors.
- [x] OSM attribution is visible; no participant data or privileged key is exposed.
- [x] Boundary/CRS mismatch fails clearly instead of silently rendering a wrong extent.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map/components/CityMap.test.tsx` passes seven-feature loading, attribution, wrong/missing CRS, out-of-extent and resize-fit guards.
- [x] `npm run build` succeeds.
- [x] Browser check: verify all seven polygons fit at 375px and desktop after resize, no horizontal overflow, GeoJSON loads lazily, and visible tiles load.
- [ ] Confirm Prefeitura data license/attribution and perform the requested manual GIS comparison before public preview.

**Dependencies:** T01, T02b, T03.

**Files likely touched:**
- `src/data/maringa-urban-boundary.geojson`
- `src/features/territory-map/components/CityMap.tsx`
- `src/features/territory-map/components/CityMap.test.tsx`
- `src/features/identity-access/components/AuthForm.tsx`
- `src/styles.css`
- `src/main.tsx`
- `docs/geo-data.md`

**Estimated scope:** Medium.

## Task T08: Generate and preview balanced partitions

**Description:** Let city leadership draw/save validated primary region drafts and publish/replace those maps. Subdivisions now follow manual individual creation with immediate availability in MN01–MN06.

**Scope revision (2026-10-13):** The automatic subdivision generation, area-balance and separate draft/publication portions below record earlier implementation evidence only; they are superseded by the approved manual flow and must not be resumed as current requirements. Preserve completed checks as history; apply existing partition/realignment rules only where still required for primary region maps. Outstanding manual-subdivision work is tracked in MN01–MN06.

**Status note (2026-10-12):** PostGIS 3.3.7 is enabled locally. Only the city leader can draw/save colored region drafts, generate subdivisions with UTM long-axis bisection, edit vertices with Geoman, and save changes after PostGIS validation. Generated subdivision IDs remain stable by number. Initial publication and replacement are implemented: replacement requires explicit destinations for every active membership; the new map, archived publication, released/created membership rows, and audit records commit atomically. RLS exposes current membership names/areas only to city leadership, and the UI blocks publication until every destination is selected. Sector leaders cannot edit subdivisions. The participant UI loads published regions/subdivisions read-only through the RLS-scoped map RPC. Turf's actual-data geodesic estimate differs 0.24% from the PostGIS geodesic union, so its UI value is only a preview. See `docs/geo-data.md`.

**Acceptance criteria:**
- [x] Manually drawn Polygon/MultiPolygon drafts are checked for validity, parent containment, overlaps, coverage, and the ±15% target before saving.
- [x] Server validation reports measured area deviation and rejects drafts outside tolerance; no partition is auto-published.
- [x] The schema has stable region/subdivision IDs and supports assigning multiple regions to a sector leader.
- [x] City leadership can group region components, preview the partition, edit colors, and save/update a draft.
- [x] City leadership can generate balanced subdivisions for a saved region and edit their vertices before revalidation/saving.
- [x] Replacing a published map requires an explicit valid destination for every active membership and atomically preserves the old publication and membership history on failure.

**Verification:**
- [x] PostGIS is available locally in the dedicated `extensions` schema; `ST_Transform` and `ST_IsValid` smoke check passes.
- [x] All seven official polygons are stored in PostGIS and protected from anonymous reads and authenticated writes.
- [x] PostGIS subdivision generator passed the official union at counts 2, 3, 5, 7, and 10 with valid geometry, containment, coverage, no overlaps, and deviation under 0.01%.
- [x] Turf preflight tests cover containment, MultiPolygon components across separate nuclei, target counts, and ±15% deviation; actual source is checked against the PostGIS geodesic area.
- [x] PostGIS RPCs validate parent containment, area balance, overlap, coverage, and input complexity; edit saves preserve IDs and reject invalid geometry.
- [x] Assigned and unassigned sector leaders are denied subdivision edits; direct table updates and private RPC execution are revoked.
- [x] Initial publication requires a complete, PostGIS-validated region/subdivision hierarchy and exposes it through participant RLS.
- [x] Participant UI loads visible published geometries after authentication and offers read-only region selection.
- [x] `npm run test -- --run src/features/territory-map/lib` covers count, geometry, colors, and area deviation.
- [x] `npm run test:db` verifies PostGIS geometry constraints and draft persistence/RLS.
- [x] Replacement rejects omitted or old-map destinations without changing the published map or active memberships; complete realignment archives the old map and preserves released membership/audit history.
- [ ] Manual check: try several counts against the actual Maringá polygon and confirm refusal/feedback when tolerance cannot be met.

**Dependencies:** T07.

**Files likely touched:**
- `src/features/territory-map/lib/generatePartitions.ts`
- `src/features/territory-map/lib/generatePartitions.test.ts`
- `src/features/territory-map/components/PartitionGenerator.tsx`
- `supabase/migrations/<territory-schema>.sql`
- `supabase/tests/territory-geometry.sql`

**Estimated scope:** Medium.

## Task T09: Edit map geometry and assign sector regions

**Description:** Complete the city-leader region/subdivision editor and assignment workflow; sector leaders may have region assignments for operational features but cannot edit subdivisions.

**Acceptance criteria:**
- [x] Only city leaders can edit regions and subdivisions; sector leaders are denied even in assigned regions.
- [ ] Invalid/out-of-parent/overlapping/incomplete geometry is rejected by database validation.
- [ ] Color changes are persisted and remain distinct unless a leader intentionally edits them.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map` covers editor controls and city-leader role scope.
- [x] `npm run test:db` denies subdivision edits for assigned and unassigned sector leaders.
- [ ] Manual check: city leader edits a subdivision; assigned/unassigned sector leaders are refused.

**Dependencies:** T06, T08.

**Files likely touched:**
- `src/features/territory-map/components/GeometryEditor.tsx`
- `src/features/territory-map/components/RegionAssignmentPanel.tsx`
- `src/features/territory-map/lib/territoryService.ts`
- `src/features/territory-map/components/GeometryEditor.test.tsx`
- `supabase/tests/territory-rls.sql`

**Estimated scope:** Medium.

## Task T10: Deliver subdivision membership and safe realignment

**Description:** Let participants select and switch their single active subdivision. Prevent geometry changes from deleting/splitting occupied areas until affected memberships are reassigned. The city-leader replacement workflow and atomic membership realignment are implemented; participant enrollment/switching is implemented and locally browser-verified.

**Acceptance criteria:**
- [x] Database enforces at most one active subdivision membership per participant.
- [x] Participants can create/switch only their own membership through an authenticated RPC; each change is transactionally recorded and the prior row remains as history.
- [x] Replacing a published map requires every active membership to move to a subdivision in the new map in the same transaction; invalid or missing destinations roll back.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map` covers participant selection/switching, city-leader realignment UI, and publication gating.
- [x] `npm run test:db` covers uniqueness, participant ownership/privacy, role denial, exact mapping, invalid/omitted destination rollback, archived publication, and membership history.
- [x] Browser-tested participant enrollment and switching on a disposable local account; verified one active link plus one released history row and removed the test account/map afterward.
- [ ] Manual check: attempt an occupied-area split, reassign participants, and retry.

**Dependencies:** T09.

**Files likely touched:**
- `supabase/migrations/<subdivision-memberships>.sql`
- `supabase/tests/subdivision-memberships.sql`
- `src/features/territory-map/components/SubdivisionSignup.tsx`
- `src/features/territory-map/lib/membershipService.ts`
- `src/features/territory-map/lib/membershipService.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Territory
- [x] Participant map selection and one-active-area registration work; disposable-account browser verification completed.
- [ ] City/sector editing and area realignment protections pass RLS/PostGIS tests.
- [ ] Review partition quality with the actual boundary before events are added.

## Task T11: Deliver leadership act management

**Description:** Add act schema and create/edit/cancel forms for city-wide and subdivision scopes. City leaders manage all acts; sector leaders manage only acts in their assigned regions. A canceled act remains visible with registrations preserved.

**Acceptance criteria:**
- [x] Act stores title, predefined category, start time, address/map point, one generated scope, and scheduled/cancelled status.
- [x] Only city leaders can create city-wide acts; sector leaders manage only assigned subdivisions.
- [x] Cancel changes status without deleting the act; no automatic notification is sent.

**Verification:**
- [x] `npm run test -- --run src/features/acts` passes service, scope, edit, and cancellation cases.
- [x] `npm run test:db` passes act authorization, fail-closed identity, and city-perimeter point validation.
- [ ] Manual check: create both act scopes, edit, cancel, and verify retained record.

**Dependencies:** T10.

**Files likely touched:**
- `supabase/migrations/20261013041136_acts_leadership_management.sql`
- `supabase/tests/act_management.test_test.sql`
- `src/features/acts/lib/actService.ts`
- `src/features/acts/components/ActManagement.tsx`
- `src/features/acts/components/ActManagement.test.tsx`
- `src/features/identity-access/components/AuthForm.tsx`

**Estimated scope:** Medium.

## Task T12: Deliver agenda and participant act signup

**Description:** Show upcoming/cancelled acts in agenda and map views and let any participant register for any Maringá act and cancel their own registration before its start.

**Acceptance criteria:**
- [x] Participants can discover city-wide and subdivision acts in agenda and map views without being restricted by their own subdivision.
- [x] There is no capacity limit; a participant may register for multiple acts while the database enforces one active registration per participant/act.
- [x] Participants see their own registration state and can cancel it before start, but cannot read other participants' registrations.

**Verification:**
- [x] `npm run test -- --run src/features/acts` covers agenda/map views, any-subdivision signup, and own-registration cancel.
- [x] `npm run test:db` covers unlimited participants per act, multiple acts per participant, own-only reads, and cancellation timing/history.
- [ ] Manual check: register for a subdivision act outside the participant's assigned area and cancel before start.

**Dependencies:** T11.

**Files likely touched:**
- `supabase/migrations/20261013042540_participant_act_registrations.sql`
- `supabase/tests/act_registration_behavior.test_test.sql`
- `supabase/tests/act_registration_enrollment.test_test.sql`
- `src/features/acts/components/ActAgenda.tsx`
- `src/features/acts/components/ActAgenda.test.tsx`
- `src/features/acts/lib/actService.ts`
- `src/features/acts/lib/actService.test.ts`
- `src/features/identity-access/components/AuthForm.tsx`

**Estimated scope:** Medium.

## Task T13: Deliver private leadership attendee rosters

**Description:** Let authorized sector and city leaders view the signup roster for acts they can manage, including participant name and the WhatsApp link permitted by the identity spec.

**Acceptance criteria:**
- [x] Participants cannot query attendee names, phone numbers, or roster counts; direct registration reads remain self-only.
- [x] Assigned sector leaders see rosters for assigned subdivision acts; city leaders see all Maringá rosters.
- [x] WhatsApp links use normalized participant numbers and are rendered only in the authorized leadership panel.

**Verification:**
- [x] `npm run test -- --run src/features/acts` passes role-specific roster and contact-link tests.
- [x] `npm run test:db` verifies city/assigned/unassigned/participant roster access and active-registration filtering.
- [ ] Manual check: compare city-leader, assigned sector-leader, unassigned sector-leader, and participant views.

**Dependencies:** T12.

**Files likely touched:**
- `supabase/migrations/20261013043548_private_act_attendee_rosters.sql`
- `supabase/tests/act_attendee_roster.test_test.sql`
- `supabase/tests/act_attendee_roster_behavior.test_test.sql`
- `src/features/acts/components/ActManagement.tsx`
- `src/features/acts/lib/actService.ts`
- `src/features/acts/components/ActManagement.test.tsx`

**Estimated scope:** Small.

### Checkpoint: Acts
- [ ] City/subdivision act flows, cancellation, and roster privacy pass.
- [ ] No-capacity/no-notification scope remains enforced.

## Task T14: Deliver leadership material-point management

**Description:** Add independent material-point CRUD with free-text material/topic, map point/address, and recurring weekly pickup windows. Both leadership roles manage all points; deleting a point also deletes its windows.

**Acceptance criteria:**
- [x] City and sector leaders can create/edit/delete a point without a region/subdivision association.
- [x] A point requires free-text material/topic, address, in-city coordinates, and weekly windows; multiple non-overlapping windows per weekday are supported.
- [x] Deleting a point cascades to its pickup windows; participants cannot modify points.

**Verification:**
- [x] `npm run test -- --run src/features/material-points` covers CRUD form, roles and multiple windows; service tests cover overlap/input validation.
- [x] `npm run test:db` covers PostGIS perimeter checks, overlap rejection, cascade, participant denial, and both leader roles.
- [ ] Manual check: create a point with two windows on one weekday, edit it, then delete it.

**Dependencies:** T07; may proceed in parallel with T11-T13 after the map foundation is stable.

**Files likely touched:**
- `supabase/migrations/20261013044125_independent_material_points_management.sql`
- `supabase/tests/material_points_management.test_test.sql`
- `src/features/material-points/lib/materialPointService.ts`
- `src/features/material-points/components/MaterialPointManagement.tsx`
- `src/features/material-points/lib/materialPointService.test.ts`
- `src/features/material-points/components/MaterialPointManagement.test.tsx`
- `src/features/identity-access/components/AuthForm.tsx`

**Estimated scope:** Medium.

## Task T15: Deliver participant material-point discovery

**Description:** Show points both as Leaflet markers and as a list, with matching details and text search/filter by free-text material/topic. Reuse the shared weekly-schedule editor/formatter where practical.

**Acceptance criteria:**
- [x] Selecting a map marker or list row opens the same point details; free-text search filters both views.
- [x] Participants can read material/topic, address, and all weekly pickup windows.
- [x] No reservation, stock count, or withdrawal confirmation controls appear.

**Verification:**
- [x] `npm run test -- --run src/features/material-points` covers list/map parity, shared details, filtering, role visibility and no stock actions.
- [x] `npm run build` succeeds.
- [ ] Manual check: compare the same point's details from map and list at desktop and mobile sizes.

**Dependencies:** T14.

**Files likely touched:**
- `src/features/material-points/components/MaterialPointDiscovery.tsx`
- `src/features/material-points/components/MaterialPointDiscovery.test.tsx`
- `src/features/identity-access/components/AuthForm.tsx`
- `src/styles.css`

**Estimated scope:** Medium.

### Checkpoint: Material Points
- [ ] Both leadership roles can manage points and participants can discover them without reserve/stock features.
- [ ] Spatial/time-window RLS and validation tests pass.

## Task T16: Complete cross-role E2E and security review

**Description:** Add Playwright coverage for the full pilot journey, run cross-module authorization/privacy checks, inspect responsive behavior, and review dependency/security findings.

**Status note (2026-10-13):** As três jornadas Playwright passam localmente. Cobrem cadastro/login e disponibilidade persistida, inscrição territorial, registro/cancelamento em atos, descoberta de pontos na lista/mapa e visibilidade do roster por papel/região. A viewport móvel 390x844 não apresenta overflow horizontal. `npm audit` não encontrou vulnerabilidades; advisors locais não encontraram problemas; o bundle não contém formato de chave secreta privilegiada. Revisão manual com leitor de tela e validação em preview continuam pendentes antes da publicação.

**Acceptance criteria:**
- [x] E2E covers signup/login, availability, map membership, act registration/cancellation and attendee privacy, and material-point map/list.
- [x] E2E confirms city leader, assigned sector leader, unassigned sector leader, and participant permissions.
- [x] Security review finds no unmitigated reachable critical/high dependency findings and no client-exposed privileged credentials.

**Verification:**
- [x] `npm run test -- --run` passes (108 tests).
- [x] `npm run test:db` passes (319 assertions).
- [x] `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- [x] `npm run test:e2e` passes against local Supabase (3 journeys); test fixtures are removed afterward.
- [x] `npm audit --audit-level=high` reports zero vulnerabilities; `supabase db advisors --local --type security` reports no issues.
- [x] Browser test at 390x844 confirms no horizontal document overflow and keeps participant modules visible.

**Dependencies:** T10, T13, T15.

**Files likely touched:**
- `playwright.config.ts`
- `e2e/identity-territory.spec.ts`
- `e2e/acts.spec.ts`
- `e2e/material-points.spec.ts`
- `docs/security-review.md`

**Estimated scope:** Medium.

## Task T17: Prepare and verify the production deployment

**Description:** Document required production environment variables and configure the Vercel/Supabase production deployment for the static app; deploy only after legal, technical, and launch checks are approved.

**Status note (2026-10-13):** `vercel.json` e o guia agora descrevem Production, incluindo confirmação de e-mail/SMTP e variáveis Production. Nenhum projeto Supabase/Vercel remoto está vinculado e nenhum deploy foi feito. O mapa ainda tem pendências de licença/atribuição e conferência GIS; o primeiro deploy Vercel de um projeto novo será público.

**Acceptance criteria:**
- [x] Only the Supabase publishable client key and project URL are exposed to the frontend; no service-role or database password is configured for the client.
- [ ] Production build succeeds with documented environment variables and client-side routes resolve.
- [ ] Public deployment occurs only after Supabase/Auth readiness, map publication clearance, manual acceptance checks, and launch confirmation.

**Verification:**
- [x] `npm run build` passes locally.
- [x] Local configuration uses only the two documented public Supabase variables; `.env.example` contains placeholders only.
- [x] Local Vite production preview serves `/` and a direct client-side path with the SPA shell (HTTP 200).
- [ ] Production deployment reports a successful build and loads `/` and a client-side route.
- [x] No remote deployment was triggered during this documentation/configuration step; first-deployment behavior and public-release checks are documented.
- [x] Local built-bundle scan finds no privileged Supabase key format or server-only environment variable name.
- [ ] Manual check on the production domain: verify auth/map routes, confirmation e-mail, and browser network responses contain no secret values.

**Dependencies:** T16.

**Files likely touched:**
- `.env.example`
- `vercel.json`
- `README.md`
- `docs/deployment.md`

**Estimated scope:** Small.

### Checkpoint: Complete
- [ ] Every accepted spec criterion is verified by automated test or documented manual check.
- [ ] Production domain is reviewed by the human after the map and launch gates pass.
