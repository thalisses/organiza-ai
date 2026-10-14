# Plano de Implementação: Disponibilidade semanal em múltiplos dias

## Visão Geral

Adicionar ao cadastro e à edição da disponibilidade pessoal uma forma de selecionar vários dias da semana e aplicar a todos um único intervalo de horário. A lista persistida continuará achatada em registros independentes por dia. O modo existente do editor compartilhado permanecerá inalterado para horários de retirada dos pontos de material.

## Decisões de Arquitetura

- Manter `AvailabilityWindow` e o formato de persistência atuais; não criar migration nem alterar RPC ou políticas RLS.
- Estender `AvailabilityEditor` com um modo opcional de entrada multi-dia, desativado por padrão. O modo padrão preserva o editor atual usado por pontos de material.
- No modo pessoal, selecionar dias e horários numa área de criação; ao adicionar, expandir a seleção em itens independentes dentro da lista `AvailabilityWindow` já controlada pelos pais.
- Deduplicar pelo conjunto `(dayOfWeek, startsAt, endsAt)` durante a adição. Preservar os demais itens e permitir edição ou remoção individual após a expansão.
- Ativar o modo somente nos usos pessoais em `AuthForm` e `AvailabilityManager`.
- Usar controles nativos operáveis por teclado, rótulos acessíveis por dia e estado selecionado exposto semanticamente; estilizar os dias como bolinhas segundo a referência aprovada.
- Manter textos de interface em português e não adicionar dependências.

## Ordem de Implementação

### Fase 1: Entrada multi-dia isolada no editor

Implementar o modo opcional no editor compartilhado, com seleção de dias, horários comuns para a nova entrada, validação antes de adicionar, expansão para janelas independentes, prevenção de duplicatas e edição individual dos itens existentes. Manter o modo clássico como padrão e cobrir ambos no teste do componente.

### Checkpoint: Editor

- Testes do editor passam nos modos multi-dia e clássico.
- Não há regressão no uso padrão pelo fluxo de pontos de material.
- Selecionar nenhum dia ou informar horário inválido não adiciona itens.

### Fase 2: Ativação nos fluxos pessoais e persistência

Ativar explicitamente o modo multi-dia no cadastro e no gerenciamento da disponibilidade pessoal. Cobrir a lista completa enviada para salvar e a recuperação após novo login; estender o E2E de cadastro do participante para escolher múltiplos dias.

### Checkpoint: Fluxo pessoal completo

- Cadastro e gerenciamento pessoal aplicam o mesmo horário a todos os dias selecionados.
- Após salvar e recarregar, os dias continuam como itens independentes e os horários existentes permanecem.
- Os horários de retirada de materiais mantêm o comportamento atual.
- Critérios da spec passam nos testes focados, gates gerais e fluxo E2E.

## Tarefas

As tarefas detalhadas e os comandos de verificação estão em `tasks/weekly-availability-todo.md`.

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| O editor é compartilhado com pontos de material | Mudança acidental no cadastro de horários de retirada | Modo multi-dia opt-in; manter o padrão atual e adicionar teste de regressão do modo clássico. |
| A atualização do estado substitui horários já cadastrados | Perda de disponibilidade pessoal | Expandir sobre a lista atual recebida por props, preservar itens existentes e testar caso misto com dias duplicados e novos. |
| A UI confunde seleção para novo horário com edição de horários existentes | Alterações acidentais em dias ou intervalos salvos | Separar o formulário de nova entrada da lista de itens independentes; testar alteração e remoção isoladas. |
| Botões circulares não comunicam dia ou seleção a tecnologias assistivas | Fluxo inacessível por teclado/leitor de tela | Usar rótulos explícitos, estado selecionado semântico e testes de interação acessível. |

## Perguntas em Aberto

- Nenhuma. A especificação e a localização dos arquivos do plano foram aprovadas.