# Spec: Disponibilidade semanal em múltiplos dias

## Objetivo

Reduzir o esforço para cadastrar a disponibilidade semanal pessoal: ao criar um intervalo, a pessoa seleciona um ou mais dias da semana em controles circulares e informa um único horário inicial e final. O intervalo deve ser aplicado a cada dia selecionado sem agrupar os dias; depois de salvo, cada dia continua independente.

Esta mudança se aplica ao fluxo de disponibilidade da conta da própria pessoa, usado no cadastro e no gerenciamento do perfil. O editor de horários de retirada de pontos de material não deve ganhar nem perder comportamento por causa desta mudança.

### Premissas confirmadas

- A disponibilidade pertence à pessoa autenticada, que cadastra os próprios horários.
- Cada dia selecionado recebe um registro de intervalo independente.
- Intervalos já cadastrados são mantidos; um intervalo idêntico no mesmo dia não é adicionado novamente.
- Os controles de dia são bolinhas selecionáveis, conforme a referência visual fornecida.
- Não há mudança planejada no schema: o modelo atual já representa um dia por registro e permite vários registros no mesmo dia.

## Stack Técnica

- React 19 e TypeScript 5, com Vite 6.
- Supabase PostgreSQL e `@supabase/supabase-js` para persistência atual.
- Vitest e React Testing Library para testes de componentes e serviços; Playwright para fluxos E2E.
- Horários semanais interpretados no fuso `America/Sao_Paulo`.
- Não se prevê dependência nova nem migration de banco.

## Comandos

```sh
npm run test -- --run src/features/identity-access/components/AvailabilityEditor.test.tsx
npm run test -- --run
npm run build
npm run lint
npm run test:e2e
```

## Estrutura do Projeto

```text
src/features/identity-access/components/AvailabilityEditor.tsx       Editor da disponibilidade pessoal
src/features/identity-access/components/AvailabilityEditor.test.tsx  Testes do editor
src/features/identity-access/components/AvailabilityManager.tsx      Consulta e gravação da disponibilidade pessoal
src/features/identity-access/lib/availabilityService.ts               Validação e persistência dos intervalos
src/features/material-points/                                         Fluxo de horários de retirada, fora do escopo
```

O editor é compartilhado com a gestão de horários dos pontos de material. A implementação deve limitar a seleção múltipla ao fluxo pessoal ou garantir explicitamente que o fluxo de material continue com seu comportamento atual.

## Comportamento e Estilo

- A pessoa pode selecionar um ou mais dias da semana para um novo intervalo.
- Cada dia é um controle circular selecionável, com indicação perceptível dos estados selecionado e não selecionado. Os dias mantêm rótulos acessíveis e podem ser operados por teclado.
- Os horários inicial e final são compartilhados pelos dias selecionados naquele cadastro.
- Não é possível adicionar o intervalo enquanto nenhum dia estiver selecionado ou os horários forem inválidos.
- Ao adicionar, criar um intervalo independente para cada dia selecionado. Um dia já selecionado no editor não pode ser alterado ou removido como efeito colateral de editar outro dia.
- Preservar todos os intervalos existentes. Se um dia selecionado já possuir exatamente o mesmo horário inicial e final, não criar duplicata para esse dia; adicionar o intervalo aos demais dias elegíveis.
- Manter os horários no formato `HH:mm` e exigir que o horário final seja posterior ao inicial.
- Textos visíveis e acessíveis da interface permanecem em português; nomes de tipos, funções e arquivos seguem a convenção em inglês.

Contrato persistido existente, sem mudança de formato:

```ts
export interface AvailabilityWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAt: string;
  endsAt: string;
}
```

O formato de armazenamento continua sendo uma lista de `AvailabilityWindow`, com um único `dayOfWeek` por item. A gravação continua usando o fluxo existente de substituição da disponibilidade: a lista completa, incluindo todos os intervalos preservados, é enviada para salvar.

## Estratégia de Testes

- Vitest e React Testing Library verificam seleção de vários dias, operação por teclado e anúncio acessível do estado selecionado.
- Verificar que adicionar um intervalo cria um registro independente por dia selecionado, com horários iguais, e permite editar ou remover um registro sem alterar os demais.
- Verificar preservação de intervalos anteriores, deduplicação exata por dia e o caso misto em que alguns dias já têm o intervalo e outros ainda não.
- Verificar que não se pode adicionar com zero dias ou com horários inválidos e que a seleção de apenas um dia continua funcionando.
- Testar o fluxo de persistência pessoal para garantir que a lista completa é salva e recarregada sem perda dos intervalos anteriores.
- Manter cobertura de regressão para o editor de horários de retirada usado em pontos de material.
- Executar também os testes gerais, build e lint antes de considerar a implementação pronta.

## Limites

- **Sempre:** preservar os intervalos existentes; persistir um dia por registro; validar horários; impedir duplicatas exatas no mesmo dia; manter independência entre os dias; preservar autorização e RLS existentes.
- **Perguntar antes:** alterar schema, RPC ou política RLS; adicionar dependências; mudar os horários de retirada de pontos de material ou seu editor compartilhado.
- **Nunca:** substituir a lista existente apenas pelos novos dias selecionados; permitir que selecionar ou editar um dia altere outro; aceitar um intervalo cujo horário final não seja posterior ao inicial.

## Critérios de Sucesso

1. A pessoa consegue selecionar vários dias pelas bolinhas e informar o intervalo uma única vez.
2. Ao adicionar, cada dia selecionado que ainda não tenha esse intervalo recebe seu próprio registro com os mesmos horários.
3. Intervalos existentes permanecem salvos, e um intervalo idêntico no mesmo dia não é duplicado.
4. Cada registro de dia pode ser alterado ou removido sem afetar os demais.
5. Seleção de um único dia, validação de horário, persistência e edição da disponibilidade pessoal continuam funcionando.
6. O comportamento de horários de retirada dos pontos de material permanece inalterado.
7. Os testes focados e gerais, o build e o lint passam.

## Fora do Escopo

- Agrupar dias para que alterações futuras em um deles afetem os demais.
- Alterar o schema, RPC ou políticas RLS de disponibilidade.
- Alterar a disponibilidade de retirada de materiais ou os controles de gestão de pontos.
- Alterar fuso horário, validação temporal ou formato dos intervalos existentes.

## Perguntas em Aberto

- Nenhuma para esta especificação.