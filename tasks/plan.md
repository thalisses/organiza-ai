# Implementation Plan: Organiza AI MVP

## Overview

Build the approved Maringá/PR pilot as a static React application on Vercel backed by Supabase Auth and PostgreSQL. Implement the approved capability sequence: identity/access, territory map, then acts and material points. Deliver usable vertical slices with database constraints, RLS policies, UI, and focused tests together; do not start implementation until this plan is approved.

## Architecture Decisions

- **Client and hosting:** React 19, TypeScript 5, Vite 6, npm, and Vercel static hosting. Pin resolved dependency versions and commit the lockfile. Do not expose Supabase service-role credentials to the browser.
- **Verified scaffold versions:** Node 24.21 LTS, npm 11.19.0, React/React DOM 19.3.0, TypeScript 5.9.3, Vite 6.4.4, Supabase JS 2.117.3, Leaflet 1.9.4, React Leaflet 5.0.0, `@geoman-io/leaflet-geoman-free` 2.20.2 (MIT), React Vite plugin 4.7.0, Vitest 4.1.11, ESLint 10.12.0, and jsdom 30.1.2. Peer ranges accept React 19 and Vite 6. Vitest 4.1.11 is the first 4.x release outside the audited vulnerable ranges. Lock exact dependency versions and review package lifecycle scripts.
- **Identity and authorization:** Supabase Auth owns credentials. Application profile data and role assignments live in protected database records. RLS is the authorization boundary; never authorize using user-editable auth metadata. Provision the initial city leader using a trusted administrative procedure, then allow that leader to assign sector-leader roles.
- **Data API privileges:** Explicitly grant only required table/function privileges in migrations, separately from RLS. Do not assume public-schema tables will be automatically exposed; Supabase's announced 2026-10-30 change disables that default.
- **Territorial model:** PostGIS stores the approved urban perimeter, color regions, numbered subdivisions, leader-to-region assignments, and participant memberships. Validate geometry in the database. Measure areas in square meters using geography or a validated local projected CRS, not raw EPSG:4326 degree units.
- **Boundary source:** Obtain Maringá's current legal urban-perimeter geometry from the Prefeitura. Validate source, license, and CRS; do not substitute the IBGE municipal boundary, which includes rural areas. If the official vector is unavailable, stop the boundary-dependent work until an official representation and conversion are validated with the Prefeitura.
- **Map generation/editing:** Use the pinned Leaflet/Geoman stack for editing. Automatic partitioning and the ±15% target apply only to primary regions. Subdivisions follow the approved manual individual flow: valid clipped polygons, overlap/partial coverage allowed, saved and immediately available on completion; implementation is tracked in MN01–MN06.
- **Acts:** An act has exactly one scope: the city or a numbered subdivision. Sector leaders manage acts in assigned regions; only the city leader creates city-wide acts. Any participant may register for any act. Registration lists and WhatsApp contacts are leadership-only. No capacity, recurrence, check-in, or automatic notifications in the MVP.
- **Material points:** Points are not linked to regions. Both leadership roles manage all city points. Material/topic are free-text; weekly pickup windows allow multiple intervals per weekday. Participants can view map/list/details, with no stock or reservation features.
- **Verification:** Vitest and React Testing Library cover domain/UI; Supabase local tests cover RLS and PostGIS constraints; Playwright covers core role-based journeys. Run focused tests and a build at each slice; complete a cross-module E2E/security checkpoint before a Vercel preview.
- **Dependencies:** No application manifest exists yet. Dependencies beyond the approved stack and required map tooling must be evaluated during the scaffold; do not add unrelated services. Verify current Supabase docs and CLI commands before implementing Supabase-specific behavior.

## Task List

### Phase 1: Readiness and Foundation
- [~] T01: Obtain and validate the legal urban-perimeter geometry; prove generation feasibility (official 7-polygon layer selected; publication checks pending).
- [x] T02a: Lock the React/Vite/TypeScript toolchain, select Geoman, and establish a fail-closed npm script policy.
- [x] T02b: Add ESLint configuration, a runnable React shell, and smoke tests.
- [x] T03: Create Supabase local configuration, identity schema, and database-test wrapper with RLS.
- [x] T04a: Add ignored local environment files and a lazy, tested Supabase client.
- [x] T04b: Implement and test the signup/login service contract.
- [x] T04c: Deliver accessible participant signup/login UI with component tests.
- [x] T05: Deliver required weekly availability editing.
- [x] T06: Deliver trusted city-leader bootstrap and sector-leader assignment.

### Checkpoint: Foundation
- [x] Identity flows, RLS tests, and build pass; city leader provisioning is documented.
- [ ] Official boundary file, CRS, attribution/license, and partition feasibility are reviewed.

### Phase 2: Territory Map
- [x] T07: Load the official 7-polygon urban-perimeter layer and render the read-only city map locally (public preview checks pending).
- [~] T08: Persist/publish/replace primary region maps and deliver manual subdivisions one at a time with immediate availability (new subdivision flow tracked in MN01–MN06; primary-map replacement retains its existing realignment rules; enrollment remains in T10).
- [~] T09: Complete city-leader geometry editor and region assignment workflow (sector-leader subdivision editing is explicitly disabled by product decision).
- [~] T10: Deliver one-active-subdivision signup/switch and safe realignment (participant enrollment/switch was browser-tested locally with a disposable account; manual city-leader map replacement check remains).

### Checkpoint: Territory
- [ ] Participant selection and leader editing work against PostGIS; realignment safeguards pass.

### Phase 3: Acts and Material Points
- [~] T11: Deliver leadership act creation/edit/cancel for city and subdivision scopes (implementation and automated gates pass; manual authenticated browser check remains).
- [~] T12: Deliver agenda/map discovery and participant act signup/cancellation (UI, RLS, unlimited registrations and timing rules pass automated tests; manual authenticated browser check remains).
- [~] T13: Deliver private leader attendee rosters with authorized WhatsApp links (database authorization, contact RPC, and scoped UI pass automated tests; manual role-by-role browser check remains).
- [~] T14: Deliver leadership CRUD for independent material points and weekly windows (CRUD, PostGIS validation, RLS and automated gates pass; manual browser check remains).
- [~] T15: Deliver participant material-point map/list/details (list/map parity, search, details and no-stock controls pass automated checks; manual desktop/mobile browser check remains).

### Checkpoint: Core MVP
- [ ] Acts and material points satisfy their RLS tests and work with the approved territory map.

### Phase 4: Integration and Production
- [x] T16: Complete cross-role Playwright journeys, responsive/accessibility checks, and security review (local automated gates pass; manual screen-reader and production review remain pending).
- [~] T17: Prepare the production deployment and verify environment wiring (production instructions/configuration are ready; remote Supabase/Vercel setup, map clearance, manual acceptance, and public deployment remain pending).

### Checkpoint: Complete
- [ ] All approved spec acceptance criteria are covered by tests or documented manual checks.
- [ ] `npm run test -- --run`, `npm run build`, `npm run lint`, and `npm run test:e2e` pass.
- [ ] Production deployment is reviewed by the human after map/legal, infrastructure, and manual acceptance gates pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Prefeitura polygon is unavailable, outdated, or has undocumented CRS | High: blocks truthful map and partition work | Obtain source metadata and validate geometry/CRS with the Prefeitura before using it; do not use a rural-inclusive municipal boundary as a substitute. |
| Equal-area generation cannot meet ±15% for all requested partition counts | High: blocks region publication | Prototype against the real polygon early; calculate area in square meters; return measured deviations and refuse publication when outside the approved threshold. |
| Geometry editing can invalidate member assignments | High: participants can be left without a territory | Persist edits transactionally; identify affected signups and require realignment before deleting/splitting occupied areas. |
| RLS role checks expose contacts or allow privilege escalation | High: personal-data disclosure or unauthorized administration | Keep roles in server-controlled tables, test positive and negative policies with real role fixtures, and keep privileged keys server-side only. |
| Local Node/npm runtime may diverge from Vercel/CI | Medium: engine-specific tooling may fail only in one environment | Pin the supported Node/npm versions in package metadata, enforce engines, and run install/build/test on Node 24 in CI and preview. |
| OpenStreetMap public tile capacity/policy may not suit sustained production use | Medium: map may be rate-limited | Follow attribution and tile-use policy; assess traffic and choose an appropriate tile provider before scaling beyond the pilot. |
| Users may interpret signups as attendance or area equality as workload equality | Medium: inaccurate expectations | Label records as registrations, omit check-in, and present the ±15% metric as geometric area balance only. |

## Open Questions

- Obtain the official urban-perimeter data and confirm CRS/source metadata during T01; block territory geometry work until verified with the Prefeitura.

## Revisão Vigente T08/T09: Cadastro Manual Individual

**Status:** especificação e plano aprovados pelo usuário. MN01–MN06 implementadas e verificadas localmente até 2026-10-14; resultados abaixo. Preservadas tarefas/pendências dos demais módulos e o histórico SC01–SC03. Nenhum deploy remoto, reset ou commit executado.

### Objetivo

Retirar a geração automática de subdivisões e suas áreas existentes em todas as regiões, preservando eventuais cadastros manuais e os polígonos das regiões principais. A liderança conclui uma área por vez; o banco valida, recorta, insere e a disponibiliza imediatamente. Permitir sobreposição, áreas desiguais e cobertura parcial. Não implementar rascunho persistido, publicação separada ou nova interface de realocação para esse cadastro.

### Evidências e Reuso

- O editor já coleta pontos, permite cancelar/remover ponto e preserva zoom; seu modo `area` fecha e recorta o polígono com PostGIS. Reutilizar a regra geométrica, não o replay de toda a partição como mecanismo de gravação.
- A prévia atual não insere registros. A operação nova precisa retornar o ID persistido e alimentar a leitura do mapa vigente, em vez de acrescentar só uma referência temporária.
- A tabela de subdivisões e suas referências já existem; não há evidência suficiente neste plano de que todo registro antigo seja automático. Inventariar a origem em MN01 antes de classificar/remover.
- Wrappers antigos de geração/edição e validadores de publicação pressupõem quantidade fixa, cobertura/equilíbrio. Não usá-los para cadastrar uma área independente nem reduzir as validações das regiões principais.
- As tarefas SC04/SC05 de rascunho e publicação separada foram substituídas, não concluídas. SC06/SC07 permanecem como histórico; suas verificações relevantes de acessibilidade/E2E são incorporadas às novas tarefas.

### Arquitetura Proposta

1. **Origem controlada pelo banco:** adicionar identificação explícita de origem para novos registros manuais. Registros antigos só serão classificados após inventário; origem desconhecida não é equivalente a automática. Preservar IDs/geometrias das áreas manuais.
2. **Criação individual:** RPC candidata `create_manual_subdivision(regionId, geometry, requestId)` recebe um polígono, verifica liderança/cidade e região do mapa vigente publicado, recorta no pai e insere exatamente uma subdivisão. Não criar uma subdivisão que representa a região inteira como placeholder.
3. **Disponibilidade na mesma transação:** inserir diretamente na região vigente, sem mudar status do conjunto ou clonar o mapa. Participantes passam a consultá-la após commit. Regiões principais em rascunho continuam seguindo seu próprio fluxo de publicação.
4. **Retries seguros:** cliente gera um `requestId` uma vez por intenção e o reutiliza ao repetir a mesma conclusão. Banco guarda chave, autor/região e vínculo com a entrada normalizada; uma repetição igual retorna o mesmo registro, e reutilizar a chave com outra entrada falha. A escolha entre campos na tabela existente e registro privado auxiliar será fechada em MN01, com unicidade no banco.
5. **Concorrência:** bloquear a região durante contagem/numeração/inserção. Garantir limite de 50 e número único mesmo com duas sessões; não depender de `count + 1` calculado no navegador. IDs são referências; leitores não devem perder áreas válidas por possíveis lacunas na numeração após limpeza.
6. **Validação espacial reutilizada:** geometrias válidas, positivas e não vazias, recorte no contorno e limites de 1 MiB/10.000 vértices. Não exigir ±15%, cobertura completa, extremos na borda ou ausência de sobreposição entre subdivisões manuais. Não relaxar regras das regiões principais.
7. **Fim da geração automática:** retirar controles e impedir chamadas diretas aos endpoints públicos/privados de geração de subdivisões, inclusive wrappers das regiões padrão publicadas. Não remover geração de regiões principais nem apagar testes de segurança para esconder regressões.
8. **Limpeza idempotente:** somente IDs comprovadamente automáticos, de todas as regiões. Conferir inscrições, histórico e atos antes de remover; conflito interrompe a operação sem exclusão em cascata. O usuário informou que não há inscritos; verificar essa premissa sem construir uma interface de realocação nova.
9. **Interface de cadastro:** concluir aguarda a resposta canônica, adiciona a área salva, limpa somente o desenho concluído e permite iniciar a próxima. Em erro, preservar pontos e chave para retry. Cancelar/desfazer pontos não exclui uma área já salva. Retirar a restrição DEV somente depois dos gates da criação e limpeza.

Contrato candidato de resposta: `id`, `regionId`, `number`, `geometry` final recortada e `areaSquareMeters`; validar a resposta no serviço. Erros devem distinguir autorização, geometria/recorte vazio, limite de quantidade, conflito de chave e referências inesperadas na limpeza, sem expor SQL bruto. Não aceitar campo de origem ou papel vindo do cliente como autorização.

### Sequência e Dependências

`MN01 (inventário/contrato) → MN02 (criação no banco/serviço) → MN03 (concluir na interface) → MN04 (limpeza e bloqueio da geração) → MN05 (participante/acessibilidade) → MN06 (E2E/aceite)`.

MN02–MN03 formam a primeira fatia completa de cadastro individual, inicialmente em ambiente de desenvolvimento. MN04 elimina a configuração automática antiga após inventário. MN05 verifica inscrição imediata e libera o fluxo completo. Não executar limpeza como efeito de renderização, login, bootstrap ou simples abertura do mapa.

### Checkpoints e Gates

- Após MN01: documentar IDs/origem/referências verificados e contrato. Se origem for ambígua ou houver vínculos incompatíveis com a premissa, reportar antes da limpeza, sem decidir por exclusão.
- Após MN02–MN03: primeira e segunda área persistem e sobrevivem a reload, mesmo sobrepostas; falhas mantêm os pontos e retries não duplicam registros.
- Após MN04–MN05: geração bloqueada no banco/UI, áreas automáticas removidas, regiões/manuais preservadas e participante consegue se inscrever imediatamente.
- Após MN06: gates gerais e testes reais de mouse/toque/teclado em desktop/mobile registrados. Não marcar verificações não executadas como concluídas.

Comandos finais: `npm run test -- --run`, `npm run build`, `npm run lint`, `npm run test:db`, `npm run test:e2e`. Migrações aditivas via CLI; não resetar dados locais, aplicar alterações remotas, fazer deploy, criar branches ou commits sem autorização correspondente. Sincronizar o histórico local da migração de prévia já aplicada via psql antes de deployment, sem reaplicar outras pendências cegamente.

### Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Remover uma área manual classificada incorretamente | Inventário de origem/IDs em MN01; desconhecida bloqueia classificação destrutiva. |
| Duplo clique/retry cria duas subdivisões | Chave estável por intenção, unicidade no banco e conferência de autor/região/entrada antes de devolver o resultado existente. |
| Limpeza encontra inscrições/histórico/atos | Validar referências antes de deletar, interromper atomicamente e pedir decisão; não implementar realocação presumida. |
| Leituras exigem numeração contígua ou todas as regiões completas | Ajustar apenas contratos de subdivisões para zero/uma/várias áreas e números únicos; preservar regras das regiões principais. |
| Endpoint antigo recria áreas automáticas | Revogar/bloquear todas as entradas acessíveis e testar chamadas diretas com cada papel. |
| Alteração de região durante a submissão | Autorizar e validar o pai no servidor sob lock; ignorar resposta obsoleta na UI sem ocultar registro que já tenha sido confirmado. |

### Próximo Gate

Implementação local concluída; uma publicação remota futura requer decisão própria. Não há dependência nova. Alterações de regras fora da especificação aprovada exigem nova decisão.

### Resultado da Implementação MN01–MN06

- Inventário anterior à limpeza: nove subregiões coincidiam com a saída do gerador legado; não havia inscrições, histórico de realinhamento ou atos vinculados. A operação administrativa autorizada removeu essas nove áreas e manteve as quatro regiões principais.
- Novos registros têm `origin = 'manual'`, `manual_request_id` único, autor e hash da entrada. A RPC `create_manual_subdivision` valida liderança/região publicada, recorta o polígono no PostGIS e insere uma única área sem alterar as anteriores. Advisory lock por chave e lock da região protegem retries e numeração.
- A interface oferece `Nova subregião` e `Concluir e salvar`. Falha mantém pontos/chave; sucesso usa ID/geometria do servidor, limpa só o desenho concluído e permite a próxima área. Cancelar não exclui registros salvos.
- Geração automática de subregiões revogada para usuários da aplicação e controles removidos. Testes legados que precisam de geometria para fixtures usam helpers temporários, não reabrem geração em produção.
- Leitura aceita zero/uma/várias áreas e números com lacunas. Publicar regiões principais não depende mais de subregiões: nova migração mantém validação da partição principal e validade/contenção dos filhos que existirem, mas dispensa cobertura/equilíbrio/sobreposição das subáreas. A UI recarrega IDs canônicos após publicar e distingue falha de leitura de falha de publicação.
- Verificação final: 133 testes frontend, 417 verificações pgTAP, 4 jornadas Playwright, build/typecheck e lint passaram. O E2E manual também passou isoladamente após eliminar sua dependência de outra jornada para criar a conta de liderança.
- E2E cobre duas áreas sobrepostas salvas, reload, concorrência de duas chamadas com a mesma chave (mesmo ID), cliques sem reset de zoom, entrada por teclado e toque móvel emulado com cancelamento. Capturas desktop/mobile do editor conferidas.
- Advisor local de segurança não encontrou erros. Histórico local sincronizado, incluindo a migração `20261013231400_publish_regions_without_subdivision_partition.sql`; não foi acessado projeto remoto.
- Consulta após limpeza/testes: quatro regiões publicadas, zero áreas automáticas e zero áreas desconhecidas. Dados de testes descartáveis removidos pelos hooks E2E; não apagar futuros cadastros manuais para reproduzir esse estado.

Ressalvas: há overflow móvel em blocos de gestão preexistentes fora do mapa, não corrigido nesta tarefa; editor/mapa não excedem o viewport nas verificações. Leitor de tela e dispositivo físico não testados. O build ainda informa o sourcemap inválido do CSS Geoman, sem impedir sua conclusão.

<details>
<summary>Histórico SC: prévia e publicação separada (substituído; não executar SC04–SC07)</summary>

## Histórico T08/T09: Subdivisões por Cortes Manuais

Atualização aprovada em 2026-10-13: `mode: 'area'` acrescenta um polígono manual fechado que pode sobrepor subáreas existentes. O banco recorta esse polígono pela região selecionada e rejeita resultado vazio/inválido; `mode: 'split'` e geração automática mantêm suas regras anteriores. O contorno real de 18 pontos passou no navegador, com inclusão e desfazer somente na prévia. SC04/SC05 deverão permitir sobreposição desse modo validado por replay, sem dispensar autorização, contenção regional ou proteção de inscrições/atos. Não aplicar automaticamente o desenho de área às RPCs antigas de edição/publicação.

**Status:** plano e tarefas aprovados em 2026-10-13. Política de bloqueio de atos aprovada pelo usuário; SC01 e SC02 executadas, SC03 entregue como prévia de desenvolvimento, aguardando checkpoint antes da persistência SC04. A especificação em `SPEC-territory-map.md` foi aprovada. Este bloco amplia o mesmo trabalho territorial; não substitui as tarefas ou pendências anteriores. Tarefas detalhadas SC01–SC07 em `tasks/todo.md`.

### Resultado e Escopo

Na região selecionada, como GT UEM, a liderança marca pontos de uma linha e conclui um corte para criar duas áreas na prévia. Pode repetir, desfazer e salvar; publicar é uma ação distinta. Áreas manuais desiguais são permitidas, inclusive quando a origem é automática. A geração automática conserva ±15%, e as demais regras espaciais e de autorização continuam obrigatórias.

### Evidências Locais

- `CityMap.tsx` concentra seleção, geração, edição e publicação; `prepareMapReplacement` atualmente limpa as geometrias, portanto não serve para preservar automaticamente uma região como GT UEM.
- `save_subdivision_edits` atual edita uma quantidade fixa de áreas e aplica ±15%; cortar exige uma operação adicional, não apenas habilitar o botão existente.
- Os wrappers das migrações `20261013194559` e `20261013195156` gravam subdivisões diretamente nas regiões padrão publicadas e bloqueiam mudanças quando há histórico de inscrição. Não reutilizar esse comportamento para salvar a prévia manual.
- A publicação atual e os fluxos de realinhamento devem ser testados independentemente: mudar apenas a validação do navegador não autoriza áreas manuais desiguais no banco.
- Geoman Free já está instalado. Usá-lo para coleta de uma linha apenas após verificar a API; não pressupor ferramenta de divisão paga nem implementar operações poligonais ad hoc no navegador.

### Arquitetura Proposta

1. **PostGIS como fonte de verdade:** provar `ST_Split` com polilinhas no sistema métrico usado pelo projeto e verificar validade, contenção, cobertura e exatamente dois resultados. Uma prévia usa geometria fornecida como entrada, autorizada e validada, sem escrita. Não confiar em duas geometrias finais arbitrárias para caracterizar uma operação como corte manual.
2. **Rascunho de subdivisões por região:** propor armazenamento privado de uma partição em edição, vinculado à região e ao estado-base. Salvar esse rascunho não altera o mapa vigente. Isso evita clonar ou redesenhar as regiões KML e mantém IDs de áreas não cortadas. Schema e contratos novos fazem parte deste plano e requerem sua aprovação.
3. **Histórico verificável de cortes:** guardar base e sequência ordenada de cortes, incluindo o alvo; replay no servidor valida a origem manual. Na prévia, IDs temporários são distintos dos IDs persistidos; após salvar, usar o resultado canônico do servidor. Desfazer remove o último corte e restaura o snapshot correspondente.
4. **Concorrência:** leitura retorna um token do estado-base; salvar/publicar compara esse token sob lock. Toda operação que modifica subdivisões deve invalidar o token. Rejeitar entradas obsoletas em vez de substituir trabalho recente.
5. **Publicação explícita:** promover a partição salva em uma transação autorizada. Preservar geometria da região, áreas não alteradas, histórico e referências. Exigir destinos explícitos para inscrições afetadas antes de substituir a área original; falhas mantêm mapa e inscrições intactos. Reutilizar os validadores e as regras do realinhamento existentes, sem fingir que sua RPC atual já cobre publicação regional.
6. **Equilíbrio por origem validada:** registrar modo manual somente após cortes comprovados pelo servidor. Validadores de salvamento/publicação dispensam ±15% apenas para essa partição; geração automática e limites das regiões não mudam.
7. **Interface incremental:** manter modos automático/manual, coletar pontos na região selecionada, dar prévia/erros, cancelar/remover ponto/desfazer e separar salvar de publicar. Quantidade manual vem das áreas resultantes; não usar a igualdade com a quantidade automática como requisito para publicar.

Contratos candidatos (nomes finais definidos em SC01): prévia sem escrita com região/base/alvo/linha; salvamento com token-base e sequência de cortes; leitura do rascunho autorizado; publicação com revisão do rascunho e realocações explícitas. Respostas incluem IDs canônicos, geometrias, números, áreas, desvios e token de revisão. Usar códigos estáveis para corte inválido, conflito, autorização e necessidade de realocação, com mensagens em português no cliente.

### Ordem e Dependências

`SC01 (prova/contratos) → SC02 (prévia e serviço) → SC03 (desenho interativo) → SC04 (rascunho salvo) → SC05 (publicação segura) → SC06 (acessibilidade/regressões) → SC07 (E2E/aceite)`.

Cada etapa usa teste focado antes dos gates gerais. SC02 e SC03 dão uma fatia utilizável de prévia sem gravar no mapa; SC04 acrescenta retomada; SC05 entrega publicação. Não liberar publicação parcial durante etapas intermediárias. Sem delegação ou trabalho simultâneo em migrações/shared state.

### Checkpoints

- Após SC01: cortes retos e com segmentos funcionam nas geometrias reais; revisar contratos, schema, tolerâncias e referências antes de implementar a persistência.
- Após SC02–SC03: corte e desfazer funcionam na prévia de GT UEM; nenhum estado publicado ou inscrição muda.
- Após SC04–SC05: salvar/recarregar/publicar funcionam, com atomicidade, conflito e realocação testados no banco.
- Após SC06–SC07: desktop/mobile/teclado e fluxos automáticos existentes passam; documentar lacunas reais de verificação, sem marcar testes não executados como concluídos.

### Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Precisão dos extremos impede o split | SC01 define tolerância visual de snap e precisão métrica separadas, testando bordas, buracos e multipartes; rejeitar sem simplificação silenciosa. |
| Salvamento passa a publicar implicitamente | Rascunho privado e teste com participante lendo o mapa entre prévia, salvar e publicar. |
| Campo manual arbitrário ignora ±15% | Provar cortes por replay no servidor; não aceitar uma flag do cliente como validação. |
| Corte perde histórico ou vínculos de atos | SC01 inventaria referências; não apagar registros referenciados. Definir retenção da área original e bloquear publicação com vínculos não tratados até decisão explícita. |
| Edição concorrente sobrescreve mudanças | Token do estado-base, locks e testes de duas sessões; sem sucesso otimista antes da resposta do servidor. |
| GT UEM tem exceções herdadas do KML | Validar subdivisões dentro da região sem revalidar o conjunto KML como nova partição municipal; não ampliar exceções a regiões comuns. |

### Gates e Decisões Pendentes

- Plano e tarefas aprovados pelo usuário em 2026-10-13; revisar os resultados e contratos de SC01 antes de executar SC02, conforme o checkpoint.
- SC01 deve confirmar a política para atos e referências à área cortada. A especificação não autoriza realocar atos ou apagar seus vínculos automaticamente; apresentar qualquer nova regra de produto antes de alterar o banco.
- Validar em documentação oficial PostGIS/Geoman/Supabase as APIs escolhidas antes de implementá-las; nenhuma dependência nova presumida.
- Gates finais: `npm run test -- --run`, `npm run build`, `npm run lint`, `npm run test:db` e `npm run test:e2e`, com Supabase local ativo. Não resetar dados existentes sem autorização; preparar fixtures descartáveis.

### Resultado SC01: Prova Geométrica

Comando executado: `supabase test db --local supabase/tests/territory_subdivision_cut_feasibility.test_test.sql`. Resultado: 18 testes passaram, usando fixtures temporárias e rollback; nenhum registro publicado foi alterado.

- `ST_Split` separa polígonos com linhas retas e segmentadas; três cortes podem produzir quatro áreas válidas, sem perda de cobertura nem sobreposição.
- O teste usa o contorno real de GT UEM da migração KML. Uma linha interna obtida por interseção com seu contorno produz exatamente duas áreas.
- Extremos com erro numérico de 0.00000001 m impedem o split sintético. `ST_Snap` com 0.0000001 m resolve esse caso e mantém a diferença de cobertura abaixo de 0.01 m². Essa precisão numérica não substitui o ajuste visual do clique.
- Para interação, snap visual de 20 px limitado às bordas do alvo; teto independente de 1 metro no servidor para ajustar extremos à borda. O servidor devolve os extremos efetivamente usados e não recebe tolerância arbitrária do cliente. O teto tem teste negativo específico na RPC.
- Uma linha na borda não divide a área; autointerseção, saída da área e passagem por buraco devem ser rejeitadas antes do split. Multipartes podem gerar três polígonos; rejeitar quando o resultado não representar exatamente duas áreas, sem eliminar componentes.
- Esta prova não implementa ainda autorização, RPC, replay de cortes ou persistência; esses requisitos permanecem em SC02–SC05.

### Contratos SC01 para Revisão

Todos os nomes abaixo são propostos; manter endpoints atuais de geração/edição compatíveis.

| Operação | Entrada | Saída e efeitos |
|---|---|---|
| `preview_subdivision_cuts` | `regionId`, `baseToken`, lista ordenada de `{targetRef, line}` | Partição canônica com referências temporárias, geometrias GeoJSON, números, áreas, desvios e baseToken; sem escrita. |
| `save_subdivision_cut_draft` | Dados da prévia e revisão esperada do rascunho, ou ausência explícita na criação | Replay no servidor, gravação privada atômica, `draftId`, revisão, IDs canônicos e métricas; não altera a publicação. |
| `read_subdivision_cut_draft` | `regionId` | Rascunho autorizado ou ausência; dados suficientes para retomar/desfazer e seus tokens. |
| `publish_subdivision_cut_draft` | `draftId`, revisão esperada, realocações explícitas das inscrições afetadas | Promoção transacional e partição publicada canônica; falha preserva mapa, rascunho e inscrições. |

Regras compartilhadas:
- Autenticação e papel `lider_cidade` conferidos a partir de `profiles`, sem confiar em metadados de usuário; região deve pertencer à cidade autorizada e ao conjunto vigente/editável.
- `baseToken` calculado pelo servidor sobre a geometria da região e IDs/geometrias/ordem/estado das subdivisões atuais. A revisão do rascunho detecta duas lideranças editando o mesmo trabalho; locks e conferência do estado-base são obrigatórios no salvar/publicar.
- Com subdivisões existentes, cada `targetRef` inicial identifica uma área persistida. Sem subdivisões, a referência inicial representa a região inteira. Filhas usam referências de caminho determinísticas, derivadas do resultado ordenado pelo servidor; nenhuma referência é um ID persistido apenas por conter um UUID.
- Aceitar somente GeoJSON `LineString`, longitude/latitude, válido, simples, comprimento positivo, no máximo 10.000 vértices por geometria e 1 MiB por entrada. Limitar sequência para que nunca produza mais de 50 áreas; recalcular todas as áreas e numeração no servidor.
- Ler a base real e executar novamente os cortes em ordem; nunca aceitar uma flag `manual` ou geometrias finais arbitrárias como prova da exceção de ±15%.
- Validar contenção, área positiva, cobertura e sobreposição no CRS 31982; manter tolerância espacial de 0.01 m² já existente, sem derivar essa tolerância do zoom.
- Códigos previstos: `CUT_INVALID`, `CUT_TARGET_NOT_FOUND`, `CUT_LIMIT_EXCEEDED`, `DRAFT_CONFLICT`, `REALIGNMENT_REQUIRED`, `AREA_REFERENCED_BY_ACT`; autorização negada mantém SQLSTATE `42501`. Não expor erro SQL bruto ao usuário.

### Referências e Decisão de Produto SC01

Referências encontradas: `subdivision_memberships.subdivision_id`, `membership_realignments.from_subdivision_id`, `membership_realignments.to_subdivision_id` e `acts.subdivision_id`. Atos usam `ON DELETE RESTRICT`; inscrições/histórico também impedem apagar a área original.

Proposta para revisão: manter a área original como registro histórico quando for substituída, sem expô-la como subdivisão disponível; preservar IDs das áreas não cortadas e realocar inscrições ativas somente com destinos explícitos. Isso exige estado de substituição e adaptação das consultas/validações que hoje consideram todas as subdivisões da região.

Para atos, a implementação não pode inferir em qual filha o ato deve ficar. Regra aprovada pelo usuário em 2026-10-13: bloquear publicação do corte quando houver qualquer ato vinculado à área original, sem mover ou apagar esse ato automaticamente. A prova geométrica e a prévia não alteram os atos. O bloqueio efetivo será implementado e testado na publicação SC05, não na operação de prévia.

### Resultado SC02–SC03: Prévia de Desenvolvimento

- Migração aditiva `20261013211146_preview_subdivision_cuts.sql` contém funções de prévia sem escrita; aplicada ao banco local via psql, sem reset. Histórico de migração local ainda precisa ser sincronizado pelo fluxo CLI antes de deploy; não presumir que execução direta registra versão.
- RPC autorizada somente à liderança da cidade; 17 testes pgTAP cobrem entrada, token, limites, cortes sucessivos/desiguais e ausência de escrita. Cliente TypeScript valida entradas e respostas GeoJSON e traduz erros conhecidos; 28 testes do serviço passaram.
- `SubdivisionCutEditor` suporta seleção de alvo, pontos no mapa ou por coordenadas, cancelar, remover ponto e desfazer. Quatro testes de componente passam. Integração em `CityMap` fica restrita a `import.meta.env.DEV` até salvar/publicar estar pronto, sem anunciar que a feature foi entregue em produção.
- Navegador local: GT UEM já tinha quatro áreas; um corte por coordenadas produziu cinco na prévia, e desfazer restaurou quatro. Montagem limpa mostrou quatro rótulos legíveis, tiles e região enquadrada. Nenhuma gravação ou publicação executada nessa verificação.
- O teste automatizado por coordenadas de tela acionou a atribuição, não o corte; navegação restaurada para localhost. Não registrar sucesso de mouse/toque real. Captura por cliques tem cobertura de componente; validação real de mouse/toque e móvel completo permanece para SC06/SC07.
- Verificação móvel no navegador integrado inconclusiva: viewport efetivo menor que o solicitado. Controles novos cabem no espaço disponível; não alterar o layout global para corrigir um resultado não isolado.
- Supabase CLI `db query --file` não aceita múltiplos comandos nesta instalação; usar psql local para iterar SQL aditivo. Nunca resetar o banco por esse motivo.

Checkpoint atual: revisar a prévia em `http://127.0.0.1:5174/` antes de SC04. Salvar rascunho e publicar cortes ainda não existem. Aviso de sourcemap do Geoman permanece no build e não deve ser tratado como erro introduzido pela operação.

Atualização solicitada pelo usuário em 2026-10-13: o primeiro corte pode usar `targetRef: 'region'` para substituir a partição automática inteira na prévia. O servidor mantém o token da base original, reinicia o replay pelo contorno da região e ignora as bordas internas anteriores. A interface confirma a substituição; desfazer restaura as áreas anteriores. Na persistência/publicação futura, essa sequência deve considerar todas as áreas originais como afetadas para validar inscrições e atos, não somente uma subdivisão individual. Verificação real em GT UEM: quatro áreas automáticas foram substituídas por duas na prévia e restauradas por desfazer, sem escrita de geometrias.

Gates executados ao final desta fatia: `npm run test -- --run` (121 testes), `npm run test:db` (382 testes), `npm run build` e `npm run lint` passaram. E2E de salvamento/publicação não executado porque essas operações ainda não foram implementadas. Permanecem pendentes a revisão da prévia, sincronização do histórico de migração e os testes reais de mouse/toque/mobile.

### Fontes Conferidas em SC01

- PostGIS: https://postgis.net/docs/ST_Split.html (coleção resultante, suporte a linhas e aviso de precisão).
- Geoman: https://geoman.io/docs/leaflet/modes/draw-mode (`Line`, snapping, pontos, eventos e ações de desenho).
- Tipos instalados Geoman 2.20.2: `enableDraw`, `disableDraw`, `finishOnEnter`; `finishDraw` da documentação atual não aparece na declaração instalada. Não atualizar dependência nem usar internals privados por suposição.
- Supabase CLI 2.120.0: `supabase test db --help` confirma execução de arquivo focado; changelog consultado em https://supabase.com/changelog.md. Grants explícitos continuarão obrigatórios nos endpoints novos.

</details>
