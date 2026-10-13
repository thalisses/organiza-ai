# Spec: territory-map — Regiões e Inscrições por Área

## Objetivo

Disponibilizar o mapa do piloto de Maringá/PR para que participantes encontrem regiões e subdivisões e escolham onde atuar. O contorno-base é a união dos sete polígonos da camada oficial “Perímetro Urbano” da Prefeitura. As lideranças podem desenhar e ajustar regiões manualmente dentro desse contorno.

O mapa tem dois níveis:

1. A liderança da cidade define quantas regiões coloridas dividem o município e pode editar seus limites.
2. Cada região pode ter uma quantidade própria de subdivisões numeradas, geradas dentro do limite da região. A liderança da cidade atribui uma ou mais regiões a cada líder de setor para os fluxos operacionais, mas somente a liderança da cidade pode criar e editar regiões e subdivisões. Líderes de setor não podem editar subdivisões, mesmo quando associados à região.

Participantes selecionam uma região para visualizar suas subdivisões e se inscrevem em uma subdivisão. Cada pessoa mantém uma inscrição ativa por vez e pode trocá-la. Uma alteração administrativa que remova ou divida uma área com participantes inscritos não pode ser concluída até que as pessoas afetadas sejam realocadas. A substituição de um mapa publicado exige um destino explícito para cada inscrição ativa e publica o novo mapa, arquiva o anterior e registra o histórico em uma única transação; qualquer omissão ou destino inválido mantém mapa e inscrições anteriores intactos.

**Critérios de aceite do módulo:**
- Exibir um mapa interativo de Maringá com tiles do OpenStreetMap e atribuição visível ao provedor dos tiles.
- Gerar uma quantidade configurável de regiões coloridas dentro da união dos sete polígonos oficiais, aproximadamente equilibradas em área e sem sair do contorno; usar como meta que cada área gerada fique dentro de ±15% da área média esperada para aquele nível de divisão.
- Gerar, em cada região, a quantidade de subdivisões numeradas definida para aquela região; subdivisões devem permanecer dentro da geometria da região.
- Atribuir automaticamente uma cor distinta a cada região e permitir que a liderança da cidade altere a cor.
- Permitir que somente a liderança da cidade edite regiões coloridas e subdivisões; líderes de setor não podem editar subdivisões, inclusive nas regiões associadas a eles.
- Permitir edição manual de limites, sem permitir polígonos inválidos, sobreposição indevida ou áreas não cobertas dentro do respectivo limite pai.
- Ao selecionar uma região, mostrar suas subdivisões numeradas; ao selecionar uma subdivisão, oferecer a inscrição nessa área.
- Garantir no banco que cada participante tenha no máximo uma inscrição ativa em subdivisão por vez; permitir trocar a inscrição.
- Bloquear alterações que removam ou dividam áreas com participantes inscritos até que as inscrições afetadas sejam realocadas.
- Exigir realinhamento explícito de todas as inscrições ativas antes de substituir um mapa publicado; validar todos os destinos no novo rascunho e efetivar realinhamento, arquivamento e publicação atomicamente.
- Aplicar autorização no banco com RLS; ocultar controles na interface não conta como controle de acesso.

## Stack Técnica

- Frontend: React 19.x, TypeScript 5.x e Vite 6.x, conforme baselines confirmados em `SPEC-identity-access.md`.
- Mapa: Leaflet.js com tiles do OpenStreetMap; plugin de desenho/edição de polígonos ainda a escolher.
- Persistência: Supabase PostgreSQL com extensão PostGIS aprovada; geometrias como `Polygon`/`MultiPolygon` em SRID 4326.
- Hospedagem: Vercel para a aplicação web estática.
- Polígono-base: perímetro urbano legal vigente de Maringá, fornecido pela Prefeitura em formato geoespacial (preferencialmente GeoJSON ou Shapefile). Se o arquivo vetorial oficial não estiver disponível, obter a representação legal vigente junto ao órgão municipal responsável e validar qualquer conversão/digitalização com a Prefeitura antes de usá-la. A Malha Municipal 2025 do IBGE pode servir como referência do limite externo do município, mas inclui áreas rurais e não será o contorno de geração escolhido para este piloto: [produto Malha Municipal do IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html).

O contorno inicial é preparado pela equipe e persistido com regiões e subdivisões no Supabase. A geração pode ocorrer no cliente, mas geometrias recebidas do cliente devem ser validadas antes de persistir. A autorização para editar e inscrever-se é aplicada no banco por RLS e constraints/transações apropriadas.

## Comandos

Comandos propostos para o scaffold futuro; este repositório ainda não contém `package.json`:

```sh
npm run dev
npm run build
npm run test -- --run
npm run lint
```

O scaffold deve configurar scripts equivalentes para Vite, TypeScript, Vitest e ESLint. Testes E2E devem usar o comando `npm run test:e2e` quando a configuração Playwright for criada.

## Estrutura do Projeto

Estrutura proposta, com nomes em inglês conforme convenção acordada:

```text
src/features/territory-map/  Mapa, seleção de área, geração e edição de geometrias
src/features/territory-map/components/  Componentes Leaflet e controles do mapa
src/features/territory-map/lib/  Validação e operações geoespaciais do domínio
src/lib/supabase/             Cliente Supabase compartilhado
src/types/                    Tipos compartilhados de geometrias e entidades
supabase/migrations/          Schema, constraints, índices e políticas RLS
supabase/tests/               Testes de políticas e integridade espacial
src/**/*.test.ts              Testes unitários e de componentes
e2e/                           Fluxos de mapa e inscrição no navegador
```

Entidades do domínio: `CityBoundary`, `Region`, `SectorLeaderRegion`, `Subdivision` e `SubdivisionMembership`. Uma `Region` pertence à cidade piloto; `SectorLeaderRegion` associa um líder de setor a uma ou mais regiões; uma `Subdivision` pertence a uma região; uma inscrição ativa associa um participante autenticado a uma subdivisão.

## Estilo de Código

Usar inglês em nomes de diretórios, arquivos, tipos, funções e objetos do banco; textos da interface em português. Seguir TypeScript estrito, PascalCase para tipos, camelCase para campos e funções e validação em toda fronteira de entrada. Contrato ilustrativo:

```ts
export interface MapSubdivision {
  id: string;
  regionId: string;
  number: number;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}
```

Geometrias devem manter coordenadas GeoJSON em ordem longitude/latitude no intercâmbio; converter explicitamente ao usar APIs Leaflet que recebem latitude/longitude. Usar IDs estáveis, não números de exibição, como referências persistidas.

## Estratégia de Testes

- Vitest para geração de partições, contagem, atribuição de números, edição de geometria e regras de inscrição.
- React Testing Library para interação: selecionar região, revelar subdivisões, iniciar inscrição e trocar de área.
- Testes de integração Supabase/PostGIS para geometria válida, limites pai-filho, ausência de sobreposição/lacunas, cálculo do desvio para a meta de ±15%, unicidade de inscrição ativa e bloqueio de alterações que deixem inscritos sem área.
- Testes RLS: participante pode consultar o mapa e gerenciar somente sua própria inscrição; líder de setor não pode editar subdivisões, esteja ou não associado à região; líder da cidade pode visualizar e editar todas as regiões e subdivisões de Maringá; operações não autorizadas são negadas.
- Testes E2E com Playwright para seleção e inscrição, visualização do mapa, edição administrativa e bloqueio até realocação.
- Verificação mínima depois do scaffold: `npm run test -- --run`, `npm run build`, `npm run lint` e `npm run test:e2e`.

## Limites

- **Sempre:** validar geometrias no servidor/banco antes de persistir; garantir que geometrias filhas permaneçam no polígono pai; aplicar RLS e restrições transacionais; preservar IDs das áreas que continuam existindo; bloquear remoção/divisão com inscrições ativas até a realocação; mostrar atribuição do OpenStreetMap; calcular e exibir o desvio de área da geração em relação à meta de ±15%.
- **Perguntar antes:** trocar a fonte/algoritmo de geração; alterar quem administra cada nível; permitir mais de uma inscrição ativa; mudar regras de inscrição ou realocação; adicionar dependências geoespaciais ou serviços externos não aprovados.
- **Nunca:** confiar somente em validação no navegador; aceitar geometria fora do limite municipal/regional; permitir autoelevação de papel; apagar inscrições ativas em silêncio; persistir coordenadas de apresentação como se fossem coordenadas GeoJSON.

## Critérios de Sucesso

1. A liderança da cidade escolhe a quantidade de regiões coloridas e recebe uma divisão inicial dentro do polígono-base oficial aprovado para Maringá, com cada região até 15% acima ou abaixo da área média esperada; se a meta não puder ser atendida, o sistema não publica a divisão e informa o desvio alcançado.
2. A liderança da cidade consegue definir uma quantidade distinta de subdivisões para cada região e gerar áreas numeradas contidas nessa região, seguindo a mesma meta de ±15%; o sistema atribui uma cor automaticamente e permite que a liderança da cidade a altere.
3. As lideranças autorizadas conseguem ajustar manualmente os limites, e o sistema rejeita geometrias inválidas, fora do limite pai, com sobreposição ou sem cobertura completa.
4. Participantes conseguem navegar do mapa para a região, da região para a subdivisão e concluir uma inscrição nessa subdivisão.
5. O banco impede duas inscrições ativas para a mesma pessoa e preserva as inscrições encerradas como histórico.
6. A substituição de mapa só publica quando todas as inscrições ativas têm destino válido no novo mapa; omissões ou destinos inválidos não alteram a publicação nem as inscrições existentes.
7. Participante, líder de setor e líder da cidade veem apenas as ações permitidas ao seu papel; líder de setor não pode editar subdivisões mesmo quando tiver regiões associadas e a liderança da cidade consegue visualizar e editar todas as regiões e subdivisões.
8. Os casos de geração, integridade espacial, autorização, inscrição, troca e realocação têm testes automatizados.

## Fora do Escopo do MVP

- Suporte a cidades além do piloto de Maringá/PR.
- Ferramenta de importação de contornos pelo usuário final.
- Edição do polígono-base oficial (municipal ou urbano) dentro do aplicativo.
- Cadastro de atos e pontos de retirada, especificados nos módulos `acts` e `material-points`.

## Perguntas em Aberto

- Obter da Prefeitura o arquivo geoespacial do perímetro urbano legal vigente e confirmar seu sistema de referência de coordenadas antes da conversão para GeoJSON/SRID 4326.
- Escolher o plugin Leaflet de desenho/edição de polígonos no scaffold e verificar compatibilidade com React e Leaflet.
