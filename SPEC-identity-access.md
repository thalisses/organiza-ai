# Spec: identity-access — Cadastro, Autenticação e Permissões

## Objetivo

Implementar cadastro, login e perfis para o piloto de Maringá/PR. O cadastro público cria uma conta de participante com nome, WhatsApp, e-mail e disponibilidade semanal recorrente por dia da semana, obrigatória e com um ou mais intervalos. A pessoa pode consultar e editar seus próprios dados; líderes de setor e a liderança da cidade podem consultar a disponibilidade e o WhatsApp dos participantes de Maringá para coordenar a organização dos atos. A interface oferece um link direto para iniciar uma conversa no WhatsApp.

A equipe responsável pelo sistema provisiona a primeira liderança da cidade por um procedimento administrativo confiável. Essa liderança pode atribuir o papel de líder de setor. O cadastro público nunca concede nem altera papéis elevados.

**Critérios de aceite do módulo:**
- Uma pessoa consegue criar conta e entrar usando e-mail e senha.
- O perfil guarda nome, WhatsApp, cidade de atuação e papel; a senha fica sob responsabilidade do Supabase Auth e nunca é copiada para a tabela de perfil.
- Todo cadastro público recebe o papel `participante` e a cidade piloto Maringá/PR.
- O cadastro exige ao menos um intervalo de disponibilidade recorrente por dia da semana; a pessoa pode informar vários intervalos, inclusive no mesmo dia, e editá-los depois.
- O cadastro não exige confirmação de e-mail; recuperação de senha não faz parte do MVP.
- Líderes de setor e líder da cidade autenticados podem consultar disponibilidade e WhatsApp dos participantes de Maringá.
- O contato é apresentado às lideranças como link direto para iniciar conversa com o número cadastrado no WhatsApp; não é exposto a participantes nem ao público.
- A pessoa não consegue elevar seu próprio papel nem editar papel/cidade por chamadas diretas ao banco ou pela interface.
- A liderança da cidade pode atribuir e remover o papel de líder de setor; apenas a equipe confiável pode provisionar a liderança inicial da cidade.
- Regras de acesso são aplicadas no banco por Row Level Security (RLS), não apenas ocultando controles na interface.

## Stack Técnica

- Frontend: React 19.x com TypeScript 5.x; Vite 6.x como ferramenta de desenvolvimento e build (baselines confirmados).
- Identidade e dados: Supabase Auth, PostgreSQL e políticas RLS; `@supabase/supabase-js` 2.x (baseline confirmado).
- Hospedagem: Vercel para a aplicação web estática.
- Fuso horário da disponibilidade: `America/Sao_Paulo`.

Nenhuma senha, chave `service_role` ou segredo administrativo pode estar no bundle frontend. O cliente usa somente a chave pública apropriada; autorização é reforçada por RLS.

## Decisão de Sessão do MVP

O piloto permanece como aplicação React estática hospedada na Vercel, sem backend próprio para emitir cookies `HttpOnly`. A sessão do Supabase Auth usa a persistência padrão do `supabase-js` no navegador, incluindo armazenamento em `localStorage` e renovação automática.

Esta decisão aceita que scripts executados na origem da aplicação possam acessar a sessão em caso de XSS. Ela não torna `localStorage` resistente a XSS nem substitui autorização no banco. A aplicação não deve ler, copiar ou registrar tokens diretamente; a interface deve observar o estado por meio das APIs/eventos do Supabase Auth. RLS continua sendo a fronteira de autorização. Prevenção de XSS, política CSP e revisão de dependências permanecem controles importantes antes de produção. Migrar para sessão mediada por servidor/cookie `HttpOnly` exige uma decisão arquitetural futura.

## Comandos

Comandos propostos para o scaffold futuro; ainda não podem ser executados neste repositório, que não contém `package.json`:

```sh
npm run dev
npm run build
npm run test -- --run
npm run lint
```

O scaffold deve definir scripts equivalentes usando Vite, TypeScript, Vitest e ESLint. Versões exatas devem ser fixadas no `package-lock.json`.

## Estrutura do Projeto

Estrutura proposta, limitada ao módulo e seus contratos de segurança:

```text
src/features/identity-access/  Cadastro, login, perfil e disponibilidade
src/lib/supabase/              Cliente Supabase sem segredos privilegiados
src/types/                     Tipos compartilhados de perfil e papéis
supabase/migrations/           Tabelas, constraints e políticas RLS versionadas
supabase/tests/                Testes de autorização das políticas
src/**/*.test.tsx              Testes unitários e de componentes
```

O perfil público fica separado das credenciais gerenciadas pelo Supabase Auth. A disponibilidade semanal deve ser armazenada em registros próprios, associados ao perfil, com dia da semana e horário inicial/final; cada pessoa pode ter vários registros no mesmo dia e o cadastro exige pelo menos um. O WhatsApp deve ser armazenado em formato normalizado com código do país; o link usa o domínio fixo `https://wa.me/` e é exibido somente às lideranças autorizadas. Não armazenar senha nem segredo no perfil.

## Estilo de Código

Usar nomes de diretórios, arquivos, símbolos e objetos do banco em inglês; textos da interface em português. Usar TypeScript estrito, nomes de tipos em PascalCase, funções/variáveis em camelCase, valores persistidos dos papéis em snake_case e validação de entrada nas fronteiras. Exemplo do contrato de domínio:

```ts
export type UserRole = 'participante' | 'lider_setor' | 'lider_cidade';

export interface AvailabilityWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAt: string;
  endsAt: string;
}
```

`startsAt` e `endsAt` usam formato `HH:mm`; validar que o intervalo é válido e que o fim é posterior ao início. Não confiar em validação feita somente no cliente.

## Estratégia de Testes

- Vitest para validação de dados, serialização de disponibilidade e regras de interface.
- React Testing Library para fluxos de cadastro, login, edição do próprio perfil e feedback de erros.
- Testes de integração Supabase para RLS: participante lê/edita apenas o próprio perfil e disponibilidade; participante não lê perfil, WhatsApp ou disponibilidade alheia nem altera papel/cidade; ambos os papéis de liderança autorizados consultam disponibilidade e WhatsApp dos participantes de Maringá; liderança de cidade pode gerenciar papel de líder de setor; chamadas sem autenticação são negadas.
- Teste de fluxo no navegador para cadastro, login e edição de disponibilidade após o scaffold de E2E.
- Verificação mínima antes de integrar mudanças: `npm run test -- --run`, `npm run build` e `npm run lint`.

## Limites

- **Sempre:** validar entradas; proteger dados pessoais; aplicar autorização no banco em todas as operações; usar RLS com privilégio mínimo; manter segredos fora do código e do frontend; registrar mudanças de schema em migrations; permitir que a pessoa atualize seus próprios dados de perfil e disponibilidade sem poder mudar papel ou cidade.
- **Perguntar antes:** mudar o mecanismo de autenticação; alterar quem pode conceder papéis; coletar novos dados pessoais; adicionar dependências ou serviços externos; alterar a política de retenção aprovada ou incluir exportação de dados em uma versão futura.
- **Nunca:** armazenar senha em tabela de perfil; expor chave `service_role` no cliente; permitir autopromoção de papel; confiar apenas em autorização da interface; registrar senha, token ou WhatsApp completo em logs.

## Critérios de Sucesso

1. Cadastro público cria perfil de participante vinculado a uma conta Supabase Auth e à cidade Maringá/PR.
2. Senhas são processadas exclusivamente pelo Supabase Auth; nenhuma coluna de perfil contém senha ou hash de senha.
3. O cadastro é rejeitado sem ao menos um intervalo semanal válido; participante consegue salvar, visualizar e alterar um ou mais intervalos, inclusive vários no mesmo dia.
4. Usuário sem sessão não acessa perfis nem disponibilidades protegidos.
5. Participante não consegue consultar disponibilidade de outra pessoa nem alterar papel/cidade, inclusive por requisição direta.
6. Líderes de setor e líder da cidade conseguem consultar disponibilidade e WhatsApp de cada participante de Maringá; o link abre conversa com o número normalizado do participante.
7. Somente a liderança da cidade consegue atribuir/remover líder de setor dentro do fluxo normal da aplicação; a primeira liderança é provisionada pela equipe responsável.
8. Testes de RLS cobrem os casos permitidos e negados acima.

## Fora do Escopo do MVP

- Exportação de dados da conta.
- Recuperação de senha e confirmação de e-mail.

## Perguntas em Aberto

- Nenhuma para este módulo.
