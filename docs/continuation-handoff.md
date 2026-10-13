# Handoff: Organiza AI

Use este arquivo como ponto de retomada em outro chat. O objetivo é continuar a implementação do MVP aprovado, sem reabrir decisões já tomadas neste checkpoint.

## Decisão confirmada

- Manter o MVP como SPA React estática na Vercel, sem backend/BFF próprio para cookies `HttpOnly`.
- Aceitar a persistência padrão de sessão do `supabase-js` no navegador (`localStorage` e renovação automática).
- Risco aceito: JavaScript executado na origem, como em um XSS, pode acessar a sessão. Isso não protege contra XSS e não reduz o papel de RLS.
- A aplicação não deve ler, copiar ou registrar tokens diretamente; a interface observa o estado pelas APIs/eventos do Supabase Auth. A autorização permanece no banco via RLS.
- A decisão está registrada em `SPEC-identity-access.md`. Migrar para sessão mediada por servidor exige nova decisão de arquitetura.

## Estado ao pausar

- Specs/capability map e plano aprovados: `capability-map.md`, `SPEC-identity-access.md`, `SPEC-territory-map.md`, `SPEC-acts.md`, `SPEC-material-points.md`, `tasks/plan.md` e `tasks/todo.md`.
- Concluídos: T02a (toolchain), T02b (shell), T03 (schema/RLS), T04a (cliente/env) e T04b (serviço de Auth).
- Em andamento: T04c (UI de cadastro/login); ainda não está integrada ao `src/App.tsx` nem tem stylesheet próprio conectado.
- T01 permanece bloqueada até obter e validar o polígono legal do perímetro urbano da Prefeitura. Não substituir pelo limite municipal do IBGE.
- O worktree está na branch `main`; o estado relatado pelo Git tinha os arquivos do projeto como não rastreados e nada staged. Não remover esses arquivos: são o trabalho em andamento do usuário.
- Antes da decisão desta conversa, a suíte `AuthForm.test.tsx` tinha 5 testes e 4 falhas. A causa observada: falta título “Criar conta”; dois botões chamados “Entrar” (seletor e submit); e a asserção de status não corresponde ao texto renderizado (verificar pontuação/texto exato ao retomar). Cleanup do Testing Library já existe.
- `AuthForm.tsx` tem campos e ações locais, mas o estado da sessão só é alterado após submit; ainda não restaura/acompanha a sessão existente via Supabase Auth.
- `authService.ts` chama `signOut()` sem escopo; o default do Supabase é logout global. Ao retomar, avaliar e testar `{ scope: 'local' }` para o botão “Sair”.
- O servidor Vite estava ativo em `http://localhost:5173/` e o stack Supabase local estava iniciado; em outro chat, verificar se ainda estão ativos antes de usá-los.

## Próximos passos

1. Rodar novamente o teste focado de `AuthForm` e confirmar os erros atuais antes de editar:

   ```sh
   PATH=/tmp/organiza-node24/bin:$PATH npm run test -- --run src/features/identity-access/components/AuthForm.test.tsx
   ```

2. Corrigir acessibilidade e teste do formulário: oferecer heading de modo apropriado, eliminar nomes acessíveis ambíguos entre seletor e submit, e alinhar a asserção de sucesso ao texto intencional. Acrescentar/ajustar testes para estado pendente, erros e sessão restaurada.
3. Integrar `AuthForm` no `src/App.tsx` e conectar stylesheet responsivo, com foco visível e contraste acessível.
4. Expor o estado inicial e as mudanças de sessão via uma fronteira pequena no serviço de Auth usando as APIs/eventos Supabase. Não acessar `localStorage` diretamente nem confiar em `getSession()` como verificação autoritativa de identidade; o cliente SDK pode gerenciar sua própria persistência. Atualizar/desinscrever listeners corretamente.
5. Ajustar logout para encerrar apenas a sessão atual (`scope: 'local'`) e testar esse comportamento.
6. Executar os testes focados e depois os gates da fatia: `npm run typecheck`, `npm run lint`, `npm run build`; atualizar T04c em `tasks/todo.md` somente quando critérios e verificações passarem.
7. Não iniciar T05 antes de T04c concluída. T01 ainda bloqueia qualquer trabalho que dependa da geometria oficial do território.

## Ambiente verificado

- Node `24.21.0` e npm `11.19.0` disponíveis em `/tmp/organiza-node24`; prefixar comandos npm com `PATH=/tmp/organiza-node24/bin:$PATH`.
- O `.npmrc` do projeto define `ignore-scripts=true` e `engine-strict=true`.
- Stack Supabase local foi iniciado anteriormente; o comando de testes DB do projeto é `npm run test:db`.
- Últimas verificações conhecidas: T03 pgTAP 22/22; T04a testes do cliente 2/2; T04b testes do serviço 6/6. Lint/typecheck/build passaram nas fatias anteriores. Os testes de componente T04c ainda não estavam verdes.

## Instrução de retomada

Leia este handoff e as instruções do repositório; continue diretamente pelo passo 1. Preserve os arquivos não rastreados existentes e não marque T04c como concluída até integrar e validar a UI.