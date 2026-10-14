# Spec: Redesign Visual do Organiza AI

## Objetivo

Atualizar a identidade visual de todas as interfaces existentes do Organiza AI para recuperar a paleta e a direção de arte descritas em `docs/new-ui-style.md`. O trabalho atende participantes e lideranças da aplicação, tornando telas e componentes consistentes sem alterar os fluxos, a arquitetura de informação, as permissões ou as regras de negócio existentes.

O escopo é uma iniciativa visual única e transversal, não uma divisão ou reordenação das capacidades de produto do `capability-map.md`.

## Stack

- React 19.3, TypeScript 5.9.3 e Vite 6.4.4.
- CSS global em `src/styles.css`; componentes e fluxos permanecem em `src/features/`.
- Vitest e Testing Library para testes de componentes; Playwright para jornadas no navegador.
- Nenhuma dependência nova faz parte do escopo.

## Comandos

- Instalação: `npm ci --ignore-scripts`
- Desenvolvimento: `npm run dev`
- Testes unitários e de componentes: `npm run test -- --run`
- Lint: `npm run lint`
- Verificação de tipos e build: `npm run build`
- Jornadas E2E: `npm run test:e2e` (requer a stack local do Supabase em execução e ambiente configurado, conforme `playwright.config.ts`).

## Estrutura do Projeto

- `src/styles.css` — tokens, tipografia, componentes e regras responsivas compartilhadas.
- `src/features/identity-access/` — autenticação, disponibilidade e gestão de liderança.
- `src/features/territory-map/` — mapa, edição territorial e inscrição em subdivisões.
- `src/features/acts/` — gestão, agenda, inscrição e listas de participantes de atos.
- `src/features/material-points/` — gestão e descoberta de pontos de materiais.
- `src/App.test.tsx` e testes em `src/features/` — testes de componentes e comportamento.
- `e2e/` — jornadas de navegador por perfil.
- `docs/new-ui-style.md` — referência visual autoritativa.

## Direção Visual e Estilo de Código

Centralizar os valores da identidade em propriedades customizadas CSS e aplicar os tokens semanticamente, evitando reintroduzir a paleta antiga em regras de componentes.

```css
:root {
  --red: #D7141F;
  --red-2: #B30D17;
  --red-3: #7A0710;
  --red-4: #4A0309;
  --star: #FFCC29;
  --paper: #FFFFFF;
  --cream: #FFF7F2;
  --ink: #1D0B0C;
  --muted: #7C6365;
  --line: #F0DCDC;
  --radius: 18px;
}
```

- Usar Anton nos títulos, com Impact como fallback; usar Inter no texto corrido, com fallbacks locais legíveis.
- Substituir a letra atual do símbolo da marca por uma estrela amarela usando `--star` (`#FFCC29`); manter o nome textual “Organiza AI” ao lado.
- Usar sombras coloridas com `rgba(122, 7, 16, .35)` e `rgba(74, 3, 9, .55)` nos níveis de elevação apropriados.
- Preservar nomes de classes, semântica HTML e APIs de componentes sempre que possível; limitar mudanças em JSX a necessidades reais de apresentação ou acessibilidade.
- Aplicar fundos, bordas e estados de interação a partir dos tokens. Não depender exclusivamente de cor para comunicar erro, seleção ou estado.
- Manter foco visível, controles identificáveis e adaptação às larguras móveis já suportadas pelo produto.

## Estratégia de Testes

- Executar testes Vitest/Testing Library para garantir que os controles e os fluxos existentes continuam presentes e operáveis.
- Verificar os tokens e estilos computados da identidade visual no navegador, incluindo fallback tipográfico quando fontes externas não carregarem.
- Executar jornadas Playwright existentes e cobrir telas relevantes em desktop e mobile; verificar ausência de overflow horizontal a 390 px e conferir a largura mínima suportada de 320 px.
- Conferir legibilidade dos pares de texto e fundo: contraste mínimo WCAG AA de 4.5:1 para texto normal e 3:1 para texto grande; cores de atenção não substituem rótulos ou ícones.
- Rodar `npm run lint`, `npm run test -- --run` e `npm run build`; rodar `npm run test:e2e` com Supabase local disponível.
- Fazer revisão visual manual das superfícies de autenticação, território, atos e materiais em viewport desktop e móvel, verificando consistência e estados de foco, erro, seleção e desabilitado.

## Limites

- **Sempre:** preservar autorização, regras de negócio, rótulos e semântica acessível; reutilizar tokens compartilhados; validar layouts em desktop e mobile; executar testes, lint e build.
- **Perguntar antes:** alterar fluxos ou conteúdo, reorganizar navegação, modificar APIs ou regras de autorização, adicionar dependências/fontes empacotadas ou trocar a estratégia de carregamento de fontes.
- **Nunca:** remover ou enfraquecer testes para aceitar a mudança visual; mudar dados, permissões ou comportamento como efeito colateral; esconder foco, erros ou estados de controle; usar cores fora da paleta sem necessidade de acessibilidade documentada.

## Critérios de Sucesso

- `src/styles.css` define os tokens da paleta com os valores exatos do guia e as interfaces existentes usam esses tokens em vez da antiga paleta verde/coral.
- O símbolo do logo é uma estrela amarela `#FFCC29`, substituindo a letra “O” atual sem remover o nome “Organiza AI”.
- A direção visual está aplicada às interfaces existentes de identidade/acesso, mapa territorial, atos e pontos de materiais, incluindo estados de interação, sem substituir funcionalidades.
- Títulos usam Anton/Impact e corpo usa Inter, com fallback legível se o carregamento remoto não estiver disponível.
- O raio compartilhado é 18 px e as sombras de elevação usam os tons vermelhos especificados, sem sacrificar legibilidade ou foco.
- As interfaces permanecem utilizáveis em 320 px e 390 px sem overflow horizontal, e em viewport desktop; contraste de texto atende aos limites WCAG AA definidos nesta especificação.
- As jornadas e controles existentes permanecem funcionais; `npm run lint`, `npm run test -- --run` e `npm run build` passam. As jornadas Playwright passam com Supabase local configurado.

## Questões em Aberto

- Nenhuma questão bloqueante. A decisão de incluir todas as telas/componentes existentes foi confirmada antes desta especificação.
