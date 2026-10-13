# Spec: acts — Cadastro e Inscrição em Atos

## Objetivo

Permitir que participantes consultem a agenda de atos do piloto de Maringá/PR e se inscrevam nas atividades. Cada ato ocorre em uma subdivisão numerada específica ou é destinado à cidade inteira; não há associação a uma região colorida inteira.

Líderes de setor podem criar, editar e cancelar atos vinculados a subdivisões das regiões atribuídas a eles. A liderança da cidade pode criar atos para a cidade inteira e tem as permissões dos líderes de setor em todas as subdivisões e atos de Maringá. Atos são publicados ao salvar, sem fluxo de rascunho.

**Critérios de aceite do módulo:**
- Cada ato tem título, categoria pré-definida, data, horário de início, ponto geográfico e endereço de encontro, e um escopo: uma subdivisão numerada ou a cidade inteira.
- Categorias iniciais: Panfletagem, Colagem de lambe-lambe, Reunião/assembleia, Ato público, Formação/oficina e Outro. Em “Outro”, a liderança pode informar um detalhe curto.
- Líderes de setor podem criar, editar e cancelar atos somente nas subdivisões de regiões atribuídas a eles.
- Somente a liderança da cidade pode criar atos para a cidade inteira; ela pode visualizar, editar e cancelar todos os atos de Maringá.
- Participantes autenticados podem consultar os atos e se inscrever em qualquer ato de Maringá, sem restrição pela subdivisão em que estejam inscritos.
- Não há limite de vagas; uma pessoa pode se inscrever em vários atos.
- O participante pode cancelar sua própria inscrição antes do horário de início do ato.
- A lista de inscritos é visível somente às lideranças autorizadas; participantes veem suas próprias inscrições e não veem dados nem lista de outros participantes.
- Lideranças podem ver nome e WhatsApp dos inscritos, conforme o acesso aos contatos previsto em `SPEC-identity-access.md`.
- Uma liderança pode cancelar um ato sem excluir seu registro. O estado cancelado fica visível na agenda; inscrições existentes são preservadas e nenhuma notificação automática é enviada.
- Atos são ocorrências únicas, não recorrentes, no fuso `America/Sao_Paulo`.
- As permissões são aplicadas no banco por RLS, não apenas pela interface.

## Stack Técnica

- Frontend: React 19.x, TypeScript 5.x e Vite 6.x, conforme baselines confirmados em `SPEC-identity-access.md`.
- Dados e autorização: Supabase PostgreSQL, `@supabase/supabase-js` 2.x e políticas RLS.
- Mapa: Leaflet.js; atos com localização geográfica podem ser exibidos no mapa e na agenda.
- Hospedagem: Vercel para a aplicação web estática.
- Localização: persistir o ponto de encontro como `GeoJSON.Point`/PostGIS `Point` no SRID usado pelo módulo territorial, junto com o endereço legível; validar que a coordenada esteja dentro do perímetro urbano do piloto.
- Data/hora: persistir início como instante com fuso definido e exibir no fuso `America/Sao_Paulo`.

Nenhum segredo privilegiado do Supabase pode ser incluído no cliente. Validar dados recebidos e aplicar a autorização na camada de banco.

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
src/features/acts/             Agenda, cadastro, edição e inscrição
src/features/acts/components/  Cartões, formulários e lista de inscritos
src/features/acts/lib/         Regras de domínio, categorias e validação
src/lib/supabase/               Cliente Supabase compartilhado
src/types/                      Contratos compartilhados de atos e inscrições
supabase/migrations/            Tabelas, índices, constraints e políticas RLS
supabase/tests/                 Testes de autorização e integridade
src/**/*.test.tsx               Testes unitários e de componentes
e2e/                            Fluxos de consulta, inscrição e cancelamento
```

Entidades de domínio: `Act`, `ActRegistration` e `ActCategory`. Um ato tem exatamente um escopo (`city` ou `subdivision`) e um estado (`scheduled` ou `cancelled`). Uma inscrição associa um participante autenticado a um ato e tem estado e datas de criação/cancelamento.

## Estilo de Código

Usar nomes de diretórios, arquivos, tipos, funções e objetos do banco em inglês; interface em português. Seguir TypeScript estrito, PascalCase para tipos, camelCase para campos e funções e validação de entrada nas fronteiras. Exemplo do contrato de domínio:

```ts
export type ActScope =
  | { kind: 'city' }
  | { kind: 'subdivision'; subdivisionId: string };

export type ActStatus = 'scheduled' | 'cancelled';

export interface Act {
  id: string;
  title: string;
  category: ActCategory;
  scope: ActScope;
  startsAt: string;
  meetingLocation: GeoJSON.Point;
  meetingAddress: string;
}
```

Valores persistidos de categoria e estado usam identificadores estáveis em inglês, por exemplo `leaflet_distribution`, `poster_pasting`, `meeting`, `public_rally`, `training` e `other`; rótulos apresentados ao usuário permanecem em português.

## Estratégia de Testes

- Vitest para validação de título, categoria, endereço, data/hora, escopo e transições de estado/inscrição.
- React Testing Library para consulta da agenda, visualização de ato, inscrição, cancelamento da inscrição e apresentação de atos cancelados.
- Testes de integração Supabase/RLS: participante pode consultar atos e gerir somente sua própria inscrição; não pode ler inscrições ou WhatsApp de outras pessoas nem criar/editar/cancelar atos; líder de setor só administra atos de subdivisões nas regiões atribuídas; liderança da cidade administra atos da cidade e de todas as subdivisões; solicitações não autorizadas são negadas.
- Verificar que não há limite de vagas e que qualquer participante da cidade pode se inscrever em atos de qualquer subdivisão ou da cidade inteira.
- Testes E2E com Playwright para criar ato nos dois escopos, inscrever/cancelar inscrição, consultar lista por liderança e cancelar ato sem apagar histórico.
- Verificação mínima depois do scaffold: `npm run test -- --run`, `npm run build`, `npm run lint` e `npm run test:e2e`.

## Limites

- **Sempre:** validar entrada; aplicar RLS a atos e inscrições; garantir que participante só altere a própria inscrição; limitar edição de líder de setor às regiões atribuídas; preservar ato e inscrições ao cancelar; guardar o horário com fuso correto; não expor contatos a participantes.
- **Perguntar antes:** alterar a taxonomia de categorias; adicionar limite de vagas; mudar quem pode criar atos de cada escopo; adicionar notificações ou integração de mensagens; permitir atos recorrentes.
- **Nunca:** permitir que participante crie/cancele atos; expor a lista de inscritos a participantes; apagar silenciosamente atos cancelados ou suas inscrições; confiar somente em autorização da interface.

## Critérios de Sucesso

1. Lideranças autorizadas criam um ato com título, categoria, data, horário inicial, ponto/endereço e escopo válido.
2. Um líder de setor não consegue criar, editar ou cancelar atos fora das regiões atribuídas; liderança da cidade consegue administrar qualquer ato de Maringá.
3. Qualquer participante autenticado consegue consultar e se inscrever em atos de subdivisão ou da cidade inteira, sem limite de vagas e sem depender da própria subdivisão.
4. Participante consegue cancelar a própria inscrição antes do início; não consegue alterar inscrições de outra pessoa.
5. Somente lideranças autorizadas conseguem ver os inscritos e seus contatos.
6. Cancelar um ato preserva o registro, apresenta seu estado cancelado e mantém as inscrições existentes; não há envio automático de notificações.
7. Testes automatizados cobrem escopos, papéis, lista privada, inscrições, cancelamentos e datas/horários.

## Fora do Escopo do MVP

- Atos recorrentes ou séries de eventos.
- Limite de vagas, fila de espera e controle de lotação.
- Notificações automáticas por e-mail, WhatsApp, push ou outros canais.
- Confirmação de presença/check-in; a lista representa inscrições, não presença efetiva.
- Gestão de materiais de atos, coberta pelo módulo `material-points`.

## Perguntas em Aberto

- Nenhuma para este módulo.
