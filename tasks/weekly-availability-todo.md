# Tarefas: Disponibilidade semanal em múltiplos dias

Referência: `SPEC-weekly-availability.md` e `tasks/weekly-availability-plan.md`.

## Tarefa 1: Criar modo opcional de entrada multi-dia

**Descrição:** Estender o editor para permitir selecionar vários dias e um intervalo compartilhado ao adicionar, convertendo a seleção em janelas planas e independentes. Preservar o modo atual por padrão para os pontos de material.

**Critérios de aceite:**
- [ ] O modo multi-dia apresenta controles circulares acessíveis por teclado, com nome e estado selecionado perceptíveis; sem dias ou horários válidos, não adiciona intervalos.
- [ ] Ao adicionar, expande os dias selecionados em janelas independentes com os mesmos horários, preserva as existentes e ignora duplicatas exatas sem impedir a inclusão nos demais dias.
- [ ] Cada janela pode ser editada ou removida sem afetar as outras, e o modo padrão mantém o comportamento atual de um dia por janela.

**Verificação:**
- [ ] `npm run test -- --run src/features/identity-access/components/AvailabilityEditor.test.tsx`
- [ ] Testes de componente cobrem expansão, deduplicação, preservação, edição/remoção individual, validação e modo clássico.

**Dependências:** Nenhuma.

**Arquivos prováveis:**
- `src/features/identity-access/components/AvailabilityEditor.tsx`
- `src/features/identity-access/components/AvailabilityEditor.test.tsx`
- `src/styles.css`

**Escopo estimado:** Médio, 3 arquivos.

## Tarefa 2: Ativar e verificar os fluxos pessoais

**Descrição:** Ativar explicitamente o modo multi-dia no cadastro e no gerenciamento da disponibilidade da conta. Garantir que o fluxo atual persista a lista completa e estender o E2E de cadastro para verificar disponibilidade em vários dias após salvar e entrar novamente.

**Critérios de aceite:**
- [ ] Cadastro e edição da disponibilidade pessoal usam a entrada multi-dia; os pontos de material permanecem no modo clássico.
- [ ] A lista completa é persistida e recarregada como janelas independentes, sem alterar os dias não editados.
- [ ] Testes de fluxo pessoal e E2E confirmam inclusão, edição independente, persistência e ausência de regressão no editor clássico.

**Verificação:**
- [ ] `npm run test -- --run src/features/identity-access/components/AuthForm.test.tsx src/features/identity-access/components/AvailabilityManager.test.tsx src/features/material-points/components/MaterialPointManagement.test.tsx`
- [ ] `npm run test:e2e -- e2e/participant-onboarding.spec.ts`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test -- --run`

**Dependências:** Tarefa 1.

**Arquivos prováveis:**
- `src/features/identity-access/components/AuthForm.tsx`
- `src/features/identity-access/components/AuthForm.test.tsx`
- `src/features/identity-access/components/AvailabilityManager.tsx`
- `src/features/identity-access/components/AvailabilityManager.test.tsx`
- `e2e/participant-onboarding.spec.ts`

**Escopo estimado:** Médio, até 5 arquivos.

## Checkpoint: Disponibilidade pessoal

- [ ] Critérios de sucesso da `SPEC-weekly-availability.md` cobertos por testes ou verificação manual documentada.
- [ ] Testes focados e gerais, build, lint e E2E de onboarding passam.
- [ ] Editor clássico dos pontos de material continua funcional.
- [ ] Revisar com a pessoa usuária antes de encerrar a implementação.