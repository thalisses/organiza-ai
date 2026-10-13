# Spec: material-points — Locais de Retirada de Materiais

## Objetivo

Permitir que participantes encontrem locais de retirada de materiais de mobilização no piloto de Maringá/PR, consultando o tipo de material, o tema, o endereço e os horários recorrentes disponíveis. Os locais aparecem como marcadores no mapa e também em uma lista.

Cada ponto é independente das regiões e subdivisões do mapa. Líderes de setor e a liderança da cidade podem cadastrar e editar todos os pontos de Maringá; participantes consultam os pontos e seus horários, sem reservar retirada nem consultar estoque.

**Critérios de aceite do módulo:**
- Cada ponto tem nome, tipo de material e tema em texto livre, endereço legível, localização geográfica e horários semanais.
- Um ponto representa um tipo de material voltado a um tema principal; podem existir pontos diferentes para outros tipos/temas, inclusive no mesmo endereço.
- O cadastro de horários é recorrente por dia da semana e aceita um ou mais intervalos por dia.
- Pontos são mostrados como marcadores no mapa e como itens em uma lista; a seleção de qualquer apresentação abre os mesmos detalhes.
- Participantes autenticados consultam tipo/material, tema, endereço e horários.
- Líderes de setor e liderança da cidade podem criar, editar e excluir qualquer ponto do município; excluir o ponto também remove seus horários recorrentes associados. A gestão não depende da região ou subdivisão onde o local está.
- O sistema não oferece reserva de retirada, registro de retirada, controle de quantidade nem disponibilidade de estoque.
- A localização deve estar dentro do perímetro urbano legal de Maringá usado pelo módulo territorial.
- Regras de acesso são impostas no banco por RLS, não apenas ocultando controles da interface.

## Stack Técnica

- Frontend: React 19.x, TypeScript 5.x e Vite 6.x, conforme baselines confirmados em `SPEC-identity-access.md`.
- Mapa: Leaflet.js com tiles do OpenStreetMap, compartilhando o mapa e o polígono-base definido em `SPEC-territory-map.md`.
- Persistência e acesso: Supabase PostgreSQL, extensão PostGIS e `@supabase/supabase-js` 2.x.
- Hospedagem: Vercel para a aplicação web estática.
- Fuso horário dos horários semanais: `America/Sao_Paulo`.

O ponto é persistido como geometria `Point` no sistema de referência usado pelo módulo territorial, junto com o endereço para leitura humana. Validar coordenadas antes de persistir. Nenhuma chave privilegiada do Supabase pode ser incluída no cliente.

## Comandos

Comandos propostos para o scaffold futuro; este repositório ainda não contém `package.json`:

```sh
npm run dev
npm run build
npm run test -- --run
npm run lint
npm run test:e2e
```

Os scripts devem usar Vite, TypeScript, Vitest, ESLint e Playwright conforme configurados no scaffold.

## Estrutura do Projeto

Estrutura proposta, com nomes em inglês conforme convenção acordada:

```text
src/features/material-points/             Lista, mapa, filtros e detalhes dos pontos
src/features/material-points/components/  Marcadores, formulários e itens de lista
src/features/material-points/lib/          Validação de localização e horários
src/lib/supabase/                           Cliente Supabase compartilhado
src/types/                                  Tipos compartilhados de ponto e horário
supabase/migrations/                       Tabelas, índices, constraints e políticas RLS
supabase/tests/                            Testes de autorização e integridade espacial
src/**/*.test.tsx                           Testes unitários e de componentes
e2e/                                        Consulta e gestão de pontos no navegador
```

Entidades de domínio: `MaterialPoint` e `PickupWindow`. Um `MaterialPoint` pertence à cidade piloto, não tem `regionId` nem `subdivisionId`, e contém a geometria do marcador. `PickupWindow` associa um dia da semana e um intervalo de horário ao ponto.

## Estilo de Código

Usar inglês em nomes de diretórios, arquivos, tipos, funções e objetos do banco; interface em português. Seguir TypeScript estrito, PascalCase para tipos, camelCase para campos e funções e validação na fronteira. Exemplo do contrato de horário:

```ts
export interface PickupWindow {
  id: string;
  materialPointId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAt: string;
  endsAt: string;
}
```

`startsAt` e `endsAt` usam formato `HH:mm`; validar que o fim seja posterior ao início e que intervalos do mesmo ponto/dia não se sobreponham. Tipo de material e tema são campos de texto, sem catálogo fechado no MVP.

## Estratégia de Testes

- Vitest para validar texto obrigatório, coordenadas dentro do perímetro urbano, horários válidos, múltiplos intervalos e ausência de sobreposição.
- React Testing Library para consultar e filtrar pontos, abrir detalhes, ver horários, criar e editar pontos conforme o papel.
- Testes de integração Supabase/PostGIS para persistência da geometria, integridade dos intervalos e RLS.
- Testes RLS: participantes autenticados podem consultar pontos e horários, mas não criar/editar/excluir; líder de setor e liderança da cidade podem criar/editar/excluir pontos em qualquer local da cidade; chamadas não autorizadas são negadas.
- Testes E2E com Playwright para alternar mapa/lista, abrir um ponto e confirmar que horários e detalhes correspondem; testar gestão por ambos os papéis de liderança.
- Verificação mínima depois do scaffold: `npm run test -- --run`, `npm run build`, `npm run lint` e `npm run test:e2e`.

## Limites

- **Sempre:** validar localização dentro do polígono urbano do piloto; validar dias e intervalos de horário; aplicar RLS em toda operação; mostrar o mesmo registro na lista e no marcador; usar os horários locais de Maringá; não apresentar quantidade de material que não é controlada pelo sistema.
- **Perguntar antes:** adicionar vínculo dos pontos com regiões/subdivisões; introduzir catálogo fixo de materiais/temas; coletar novos dados de contato; adicionar reserva, confirmação de retirada ou controle de estoque; alterar papéis autorizados.
- **Nunca:** permitir edição por participantes; associar pontos a regiões por inferência geográfica; expor segredos do Supabase; afirmar disponibilidade de estoque sem dados de inventário.

## Critérios de Sucesso

1. Lideranças de setor e da cidade conseguem criar, editar e excluir pontos de retirada em Maringá, sem depender da região; a exclusão também remove os horários associados.
2. Cada ponto cadastrado tem material e tema em texto livre, endereço, marcador geográfico e pelo menos um intervalo semanal válido.
3. O mesmo ponto aparece na lista e no mapa e abre detalhes corretos ao ser selecionado.
4. Participantes conseguem consultar horários recorrentes, incluindo múltiplos intervalos no mesmo dia, sem opção de reservar ou alterar dados.
5. O banco impede participantes de criar/alterar/excluir pontos e permite a gestão somente aos dois papéis de liderança.
6. Os casos de localização, horários, apresentação e autorização têm testes automatizados.

## Fora do Escopo do MVP

- Associação do ponto a região colorida ou subdivisão numerada.
- Controle de estoque, quantidades disponíveis ou histórico de retiradas.
- Reserva ou inscrição para retirar materiais.
- Horários excepcionais por data ou fechamento temporário em feriados.
- Catálogo administrável de tipos de materiais e temas.

## Perguntas em Aberto

- Nenhuma para este módulo.
