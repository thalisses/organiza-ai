# Spec: territory-map — Regiões e Inscrições por Área

> Revisão aprovada em 2026-10-13 e implementada/verificada localmente até 2026-10-14: cadastro exclusivamente manual de subregiões, uma por vez, com salvamento e disponibilização automáticos ao concluir cada desenho. Removidas nove áreas automáticas pela limpeza autorizada, preservando as quatro regiões principais. O fluxo anterior de geração automática e prévia seguida de publicação separada foi substituído para subregiões. Não houve deploy remoto.

## Objetivo

Disponibilizar o mapa do piloto de Maringá/PR para que participantes encontrem regiões e subdivisões e escolham onde atuar. O contorno-base é a união dos sete polígonos da camada oficial “Perímetro Urbano” da Prefeitura. As lideranças podem desenhar e ajustar regiões manualmente dentro desse contorno. Para facilitar a configuração inicial, Maringá recebe automaticamente as quatro regiões predefinidas em `docs/GT-maringa.kml`, publicadas sem revisão da liderança quando ainda não há mapa configurado.

O mapa tem dois níveis:

1. A liderança da cidade define quantas regiões coloridas dividem o município e pode editar seus limites.
2. Cada região recebe subdivisões numeradas desenhadas manualmente, uma por vez. Concluir cada desenho válido salva e disponibiliza a subdivisão imediatamente, sem exigir cobertura completa, equilíbrio de área ou ausência de sobreposição entre subdivisões. A liderança da cidade atribui uma ou mais regiões a cada líder de setor para os fluxos operacionais, mas somente a liderança da cidade pode criar e editar regiões e subdivisões. Líderes de setor não podem editar subdivisões, mesmo quando associados à região.

### Configuração inicial de Maringá

Quando Maringá ainda não tiver rascunho nem mapa publicado, o sistema deve criar e publicar automaticamente, sem ação ou revisão da liderança, as quatro regiões abaixo usando os polígonos correspondentes do KML:

| Região | Cor |
|---|---|
| GT Unicesumar e região | `#0288D1` |
| GT Monções e região | `#7CB342` |
| GT ALVORADA MORANGUEIRA | `#F48FB1` |
| GT UEM, Vila esperança e região | `#FFEA00` |

A inicialização deve ser idempotente e não pode substituir nem alterar rascunho ou mapa já existente. As geometrias devem ser preservadas como definidas no KML, sem regeneração ou reequilíbrio automático. A publicação inicial não cria subdivisões; a liderança da cidade as configura depois, sem precisar substituir as geometrias publicadas das regiões. A inscrição em subdivisão só fica disponível quando houver subdivisões válidas; participantes podem se inscrever nas regiões coloridas assim que o mapa estiver publicado.

A publicação automática continua sujeita à validade geométrica e à contenção de cada região no perímetro urbano oficial. Somente para este mapa padrão, são aceitas as lacunas, pequenas sobreposições entre áreas e diferenças de tamanho presentes na fonte KML; seus polígonos não devem ser regenerados, reequilibrados nem alterados para formar uma partição completa. Essa exceção não se aplica às partições criadas ou substituídas pela liderança, que continuam sujeitas às validações de cobertura, sobreposição e tolerância de área. Se um polígono padrão for inválido ou sair do perímetro oficial, a operação deve falhar atomicamente, sem publicar mapa parcial ou criar um rascunho silencioso.

Participantes selecionam uma região para visualizar suas subdivisões e mantêm no máximo uma inscrição ativa em subdivisão por vez, que podem trocar. Separadamente, podem se inscrever em uma ou mais regiões coloridas; essas inscrições não substituem nem alteram a inscrição em subdivisão. Inscrições em regiões só podem apontar para o mapa publicado e são encerradas com histórico quando esse mapa é arquivado. Uma alteração administrativa que remova ou divida uma subdivisão com participantes inscritos não pode ser concluída até que as pessoas afetadas sejam realocadas. A substituição de um mapa publicado exige um destino explícito para cada inscrição ativa em subdivisão e publica o novo mapa, arquiva o anterior e registra o histórico em uma única transação; qualquer omissão ou destino inválido mantém mapa e inscrições anteriores intactos.

**Critérios de aceite do módulo:**
- Exibir um mapa interativo de Maringá com tiles do OpenStreetMap e atribuição visível ao provedor dos tiles.
- Na primeira configuração sem mapa ou rascunho existente, publicar automaticamente as quatro regiões predefinidas de Maringá com os polígonos e cores indicados nesta especificação, sem revisão da liderança e sem subdivisões iniciais; para esse mapa padrão, não exigir cobertura total, ausência de sobreposição ou tolerância de ±15% entre regiões.
- Permitir configurar subdivisões nas regiões predefinidas após sua publicação, mantendo os limites publicados das regiões; habilitar inscrição em subdivisão somente nas áreas válidas disponíveis e inscrição em regiões coloridas assim que o mapa estiver publicado.
- Tornar a inicialização idempotente e preservar qualquer rascunho ou mapa existente; não substituir configurações da liderança.
- Gerar uma quantidade configurável de regiões coloridas dentro da união dos sete polígonos oficiais, aproximadamente equilibradas em área e sem sair do contorno; usar como meta que cada área gerada fique dentro de ±15% da área média esperada para aquele nível de divisão.
- Cadastrar subdivisões somente pelo desenho manual, uma por vez; cada conclusão válida persiste e disponibiliza a área para inscrições. O resultado deve permanecer dentro da geometria da região, podendo sobrepor outras subdivisões e deixar trechos ainda não cadastrados.
- Remover as subdivisões automáticas existentes de todas as regiões, preservando as regiões principais e eventuais subdivisões manuais; retirar a opção de gerar subdivisões automaticamente.
- Atribuir automaticamente uma cor distinta a cada região e permitir que a liderança da cidade altere a cor.
- Permitir que somente a liderança da cidade edite regiões coloridas e subdivisões; líderes de setor não podem editar subdivisões, inclusive nas regiões associadas a eles.
- Permitir edição manual de limites sem polígonos inválidos ou fora do respectivo limite pai. Regiões principais criadas pela liderança mantêm suas regras de partição; subdivisões manuais aceitam sobreposição e cobertura parcial.
- Ao selecionar uma região, mostrar suas subdivisões numeradas e oferecer inscrições independentes na subdivisão e nas regiões coloridas do mapa.
- Garantir no banco no máximo uma inscrição ativa em subdivisão por participante; permitir inscrição simultânea em várias regiões coloridas, sem alterar a inscrição em subdivisão.
- Bloquear alterações que removam ou dividam áreas com participantes inscritos até que as inscrições afetadas sejam realocadas.
- Exigir realinhamento explícito de todas as inscrições ativas em subdivisão antes de substituir um mapa publicado; validar todos os destinos no novo rascunho e efetivar realinhamento, arquivamento e publicação atomicamente. Inscrições em regiões do mapa anterior são encerradas com histórico ao arquivá-lo.
- Aplicar autorização no banco com RLS; ocultar controles na interface não conta como controle de acesso.

## Stack Técnica

- Frontend: React 19.x, TypeScript 5.x e Vite 6.x, conforme baselines confirmados em `SPEC-identity-access.md`.
- Mapa: Leaflet.js com tiles do OpenStreetMap; plugin de desenho/edição de polígonos ainda a escolher.
- Persistência: Supabase PostgreSQL com extensão PostGIS aprovada; geometrias como `Polygon`/`MultiPolygon` em SRID 4326.
- Hospedagem: Vercel para a aplicação web estática.
- Polígono-base: perímetro urbano legal vigente de Maringá, fornecido pela Prefeitura em formato geoespacial (preferencialmente GeoJSON ou Shapefile). Se o arquivo vetorial oficial não estiver disponível, obter a representação legal vigente junto ao órgão municipal responsável e validar qualquer conversão/digitalização com a Prefeitura antes de usá-la. A Malha Municipal 2025 do IBGE pode servir como referência do limite externo do município, mas inclui áreas rurais e não será o contorno de geração escolhido para este piloto: [produto Malha Municipal do IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html).

O contorno inicial é preparado pela equipe e persistido com regiões e subdivisões no Supabase. A geração pode ocorrer no cliente, mas geometrias recebidas do cliente devem ser validadas antes de persistir. A autorização para editar e inscrever-se é aplicada no banco por RLS e constraints/transações apropriadas.

## Comandos

Comandos disponíveis no projeto atual:

```sh
npm run dev
npm run build
npm run test -- --run
npm run lint
npm run test:db
npm run test:e2e
```

`npm run build` também executa a verificação TypeScript. Os testes de banco requerem Supabase local; os testes E2E usam Playwright.

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

Entidades do domínio: `CityBoundary`, `Region`, `SectorLeaderRegion`, `Subdivision`, `SubdivisionMembership` e `RegionMembership`. Uma `Region` pertence à cidade piloto; `SectorLeaderRegion` associa um líder de setor a uma ou mais regiões; uma `Subdivision` pertence a uma região; `SubdivisionMembership` mantém uma inscrição ativa por participante; `RegionMembership` permite inscrições simultâneas em várias regiões publicadas, independentemente da subdivisão.

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
- React Testing Library para interação: selecionar região, revelar subdivisões, inscrever-se/trocar de subdivisão e selecionar múltiplas regiões sem afetar a inscrição em subdivisão.
- Testes de integração Supabase/PostGIS para geometria válida, limites pai-filho, sobreposição e cobertura parcial permitidas nas subdivisões manuais, salvamento/disponibilização individual, inscrição única em subdivisão e inscrições múltiplas independentes em regiões. Cobertura completa, ausência de sobreposição e meta de ±15% permanecem nos testes das regiões principais quando exigidas.
- Testes de inicialização para conferir os quatro nomes, cores e polígonos, publicação sem subdivisões, idempotência e preservação de rascunhos/mapas existentes; testar também a criação posterior de subdivisões sem substituir os limites publicados.
- Testes RLS: participante pode consultar o mapa e gerenciar somente suas próprias inscrições em subdivisão e regiões; líder de setor não pode editar subdivisões, esteja ou não associado à região; líder da cidade pode visualizar e editar todas as regiões e subdivisões de Maringá; operações não autorizadas são negadas.
- Testes E2E com Playwright para seleção e inscrição, visualização do mapa, edição administrativa e bloqueio até realocação.
- Verificação mínima depois do scaffold: `npm run test -- --run`, `npm run build`, `npm run lint` e `npm run test:e2e`.

## Limites

Subdivisões são exclusivamente manuais: não exigir equilíbrio de área de ±15%, cobertura completa da região nem ausência de sobreposição entre elas. Validade geométrica, contenção regional e autorização continuam obrigatórias. Essa regra não altera os limites ou as regras de partição das regiões principais e é independente da exceção do mapa padrão KML.

- **Sempre:** validar geometrias no servidor/banco antes de persistir; garantir que geometrias filhas permaneçam no polígono pai; aplicar RLS e restrições transacionais; preservar IDs das áreas que continuam existindo; proteger inscrições e histórico; mostrar atribuição do OpenStreetMap; executar o bootstrap padrão apenas quando não houver mapa nem rascunho; aplicar as regras de partição às regiões principais e permitir sobreposição/cobertura parcial somente nas subdivisões manuais conforme esta revisão.
- **Perguntar antes:** trocar a fonte/algoritmo de geração; alterar os polígonos ou cores predefinidos; alterar quem administra cada nível; permitir mais de uma inscrição ativa; mudar regras de inscrição ou realocação; adicionar dependências geoespaciais ou serviços externos não aprovados.
- **Nunca:** confiar somente em validação no navegador; aceitar geometria fora do limite municipal/regional; permitir autoelevação de papel; apagar inscrições ativas em silêncio; substituir rascunhos ou mapas existentes durante o bootstrap; aplicar a exceção do KML a mapas criados pela liderança; persistir coordenadas de apresentação como se fossem coordenadas GeoJSON.

## Critérios de Sucesso

1. A liderança da cidade escolhe a quantidade de regiões coloridas e recebe uma divisão inicial dentro do polígono-base oficial aprovado para Maringá, com cada região até 15% acima ou abaixo da área média esperada; se a meta não puder ser atendida, o sistema não publica a divisão e informa o desvio alcançado.
2. A liderança da cidade desenha uma subdivisão por vez na região selecionada; cada desenho válido é salvo e disponibilizado imediatamente, com ID persistente e número único na região, sem geração automática de subdivisões.
3. O sistema rejeita geometrias inválidas ou fora do limite pai, mas aceita sobreposição, áreas desiguais e cobertura parcial nas subdivisões manuais. As regiões principais mantêm suas validações existentes.
4. Participantes conseguem se inscrever em uma subdivisão e, independentemente, em uma ou mais regiões coloridas do mapa.
5. O banco impede mais de uma inscrição ativa em subdivisão por pessoa, permite múltiplas inscrições ativas em regiões e preserva inscrições encerradas como histórico.
6. A substituição de mapa só publica quando todas as inscrições ativas em subdivisão têm destino válido no novo mapa; omissões ou destinos inválidos não alteram a publicação nem essas inscrições. Inscrições em regiões do mapa anterior são encerradas com histórico.
7. Participante, líder de setor e líder da cidade veem apenas as ações permitidas ao seu papel; líder de setor não pode editar subdivisões mesmo quando tiver regiões associadas e a liderança da cidade consegue visualizar e editar todas as regiões e subdivisões.
8. Cadastro manual, disponibilização individual, remoção das subdivisões automáticas, integridade espacial, autorização, inscrição e troca têm testes automatizados; preservar as coberturas de realocação e geração de regiões principais que já existem.
9. Uma cidade Maringá sem mapa nem rascunho recebe uma única configuração publicada com as quatro regiões, cores e geometrias do KML, sem ação da liderança e sem subdivisões iniciais.
10. Reexecutar a inicialização não duplica nem altera configurações existentes; a criação posterior de subdivisões pela liderança mantém as regiões publicadas e habilita inscrições somente após haver subdivisões válidas.

## Fora do Escopo do MVP

- Suporte a cidades além do piloto de Maringá/PR.
- Ferramenta de importação de contornos pelo usuário final.
- Edição do polígono-base oficial (municipal ou urbano) dentro do aplicativo.
- Cadastro de atos e pontos de retirada, especificados nos módulos `acts` e `material-points`.

## Perguntas em Aberto

- Obter da Prefeitura o arquivo geoespacial do perímetro urbano legal vigente e confirmar seu sistema de referência de coordenadas antes da conversão para GeoJSON/SRID 4326.
- Escolher o plugin Leaflet de desenho/edição de polígonos no scaffold e verificar compatibilidade com React e Leaflet.

## Fluxo Vigente Aprovado: Cadastro Manual Individual

### Objetivo e Intenção Confirmada

Simplificar o cadastro: a liderança seleciona uma região colorida, desenha a primeira subregião e conclui; essa área é salva e já fica disponível para inscrições. Depois cadastra a segunda e as seguintes, de forma independente. Não é necessário terminar uma divisão completa do território antes de disponibilizar qualquer área.

Neste documento, subregião corresponde a `Subdivision`; região colorida corresponde a `Region`. O módulo continua sendo `territory-map`, sem novo módulo ou alteração das regiões KML.

### Premissas e Escopo

- A intenção foi confirmada explicitamente na entrevista de 2026-10-13.
- O usuário informou que não há inscritos: não criar um novo fluxo de realocação nesta mudança. Conferir essa premissa antes da limpeza, sem excluir inscrições ou histórico caso os dados tenham mudado.
- Remover as subdivisões de origem automática em todas as regiões, não somente naquela que receber o primeiro desenho manual. Preservar as já cadastradas manualmente, se existirem.
- Retirar da interface a geração automática de subdivisões e impedir sua criação por chamada direta. A geração/configuração das regiões principais não faz parte dessa remoção.
- A definição técnica de origem das áreas e eventual compatibilidade de funções antigas pertence ao planejamento; não presumir que todas as linhas do banco são automáticas quando a origem não estiver comprovada.

### Fluxo de Cadastro

1. Selecionar uma região colorida, como GT UEM. Mostrar suas subdivisões manuais existentes, ou nenhuma quando ainda não houver cadastro.
2. Iniciar uma nova subregião e marcar pelo menos três pontos sucessivos. O desenho forma uma área fechada ao concluir; não depende de extremidades no contorno nem de recortar uma área anterior em exatamente duas partes.
3. Permitir remover o último ponto, corrigir o desenho ou cancelar antes de concluir, preservando o zoom escolhido e as áreas já cadastradas.
4. Concluir executa uma única operação de validação, salvamento e disponibilização. Durante a requisição, mostrar estado pendente e impedir submissões duplicadas.
5. O banco valida a geometria, recorta o polígono pelo contorno da região selecionada e rejeita resultado vazio ou inválido. Persistir somente a geometria final contida na região.
6. Em sucesso, exibir a subregião com ID e número retornados pelo servidor, limpar apenas o desenho concluído e permitir iniciar a próxima. Após recarregar, a área continua existente e disponível para inscrições.
7. Em falha, manter os pontos e informar o motivo; não anunciar que a área foi salva. Não criar registro parcial ou alterar outras subdivisões.

Concluir o desenho é a ação explícita que dispara a gravação automática. Não salvar a cada clique nem criar uma subdivisão apenas por abrir a ferramenta. Não exigir botão posterior de salvar rascunho ou publicar para esse cadastro.

### Regras Espaciais e Disponibilidade

- Permitir subregiões sobrepostas, cruzamento das bordas de outras subregiões e áreas de tamanhos desiguais.
- Permitir regiões com zero, uma ou várias subdivisões e espaços ainda não cadastrados. O primeiro cadastro não depende dos próximos.
- A região colorida selecionada é o único limite externo do cadastro; o recorte não pode alterar essa região ou invadir uma região vizinha.
- Não exigir meta de ±15%, cobertura completa ou ausência de sobreposição para salvar/disponibilizar uma subdivisão manual.
- Preservar os limites atuais de até 50 subdivisões por região, entrada de até 1 MiB e até 10.000 vértices por geometria. Definir validação e numeração concorrente no planejamento.
- Disponibilizar apenas registros confirmados pelo servidor; o participante consulta e seleciona um ID de subdivisão explícito, mesmo quando áreas se sobrepõem. Continua valendo uma inscrição ativa por participante.
- A visualização temporária do traçado não é um rascunho de publicação nem uma área elegível para inscrições antes da confirmação do banco.
- Desfazer pontos/cancelar atua somente sobre o desenho ainda não salvo. Exclusão ou reversão de uma área já disponibilizada não está autorizada implicitamente por esse controle.

### Persistência e Remoção das Áreas Automáticas

- Somente a liderança da cidade pode cadastrar, com autorização no banco e geometrias tratadas como entrada não confiável.
- Inserir cada subdivisão e disponibilizá-la atomicamente no mapa vigente, preservando IDs/geometrias das anteriores. Não substituir o mapa inteiro a cada cadastro.
- Retries e concorrência não podem duplicar uma mesma conclusão, perder outras áreas nem repetir números. O mecanismo técnico será definido no plano.
- A limpeza deve ser idempotente e atingir apenas áreas automáticas identificadas de todas as regiões. Não apagar regiões, usuários, atos ou subdivisões manuais por efeito colateral.
- A ausência de inscritos informada pelo usuário dispensa desenhar uma nova interface de realocação agora, mas não autoriza ignorar referências existentes no banco. Se inscrições, histórico ou atos impedirem a remoção, interromper a limpeza e reportar o conflito; decidir o tratamento antes de executar uma ação destrutiva.
- Não executar a limpeza durante esta revisão da especificação nem durante o bootstrap idempotente das regiões.

### Interface, Estrutura e Estilo

Manter a interface atual, mapas/atribuição e permissões. Usar controles focados em nova subregião, pontos, cancelar e concluir; remover escolha de quantidade automática e geração de subdivisões. Não exibir prévia como se fosse sucesso persistido. Manter nomes acessíveis, foco visível, mouse/toque e alternativa de entrada por teclado.

Esta revisão herda stack, comandos, estrutura e exemplo de `MapSubdivision` das seções gerais. As superfícies de implementação continuam em `CityMap`, `SubdivisionCutEditor`, `territoryService`, migrações/testes Supabase e testes E2E. Preservar código em inglês, mensagens em português, TypeScript estrito e coordenadas GeoJSON longitude/latitude. Novas dependências, alterações de schema e contratos serão revisados no planejamento, não implementados nesta fase.

### Estratégia de Testes

- Vitest/Testing Library: concluir a primeira área, iniciar a próxima, cancelar sem apagar cadastros anteriores, falha com pontos preservados, estado pendente e ausência de controles de geração automática.
- Supabase/PostGIS: inserção individual autorizada, resultado recortado ao pai, sobreposição e cobertura parcial aceitas, primeira área sem necessidade das demais, limites de entrada, atomicidade, concorrência e retries sem duplicação.
- Testes de limpeza: atingir áreas automáticas em várias regiões, preservar manuais e regiões principais, idempotência e interrupção segura diante de referências inesperadas.
- Playwright: liderança cadastra uma área; participante a vê e pode se inscrever imediatamente; reload preserva o registro; cadastro de uma segunda área sobreposta não remove a primeira.
- Preservar testes de geração/validação das regiões principais, RLS, histórico e uma inscrição ativa em subdivisão por pessoa; cobrir inscrições simultâneas em regiões. Atualizar testes de regras de subdivisão que foram substituídas; não silenciar falhas.

Comandos de verificação na implementação: `npm run test -- --run src/features/territory-map`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `npm run lint`, `npm run test:db` e `npm run test:e2e`. Banco/E2E exigem Supabase local; não resetar dados existentes como atalho para testes.

### Limites da Revisão

- **Sempre:** validar no banco, preservar limites das regiões, salvar/disponibilizar cada área em uma operação confirmada, aceitar sobreposição/cobertura parcial e preservar áreas já cadastradas.
- **Perguntar antes:** tratar referências inesperadas na limpeza, remover áreas manuais, alterar permissões, ampliar limites, adicionar dependências ou mudar regras das regiões principais.
- **Nunca:** recriar áreas automáticas, exigir a conclusão de toda a região para cadastrar a primeira, anunciar sucesso sem confirmação, apagar dados vinculados silenciosamente ou gravar geometria fora da região selecionada.

### Critérios de Aceite

1. Todas as regiões deixam de exibir subdivisões automáticas após a limpeza autorizada, sem mudança de seus polígonos, nomes e cores; eventual cadastro manual existente é preservado.
2. A liderança não encontra geração automática de subdivisões; chamadas diretas também não conseguem criá-las.
3. Concluir o primeiro desenho válido salva uma única subregião e a disponibiliza imediatamente para consulta/inscrição, sem publicação posterior.
4. Cadastrar uma segunda área, inclusive sobreposta, preserva a primeira; não exigir preenchimento de todo o território.
5. Geometria inválida ou recorte vazio não cria registro; falha mantém os pontos. A geometria salva fica inteiramente na região selecionada.
6. Recarregar mostra os mesmos IDs e cadastros. Duplo clique, retry ou concorrência não duplica a conclusão nem apaga outra área.
7. Participantes e líderes de setor não podem cadastrar subdivisões por UI nem chamada direta; uma inscrição ativa em subdivisão por pessoa continua sendo garantida.
8. A limpeza é idempotente, preserva dados não automáticos e não exclui vínculos inesperados por cascata.
9. Controles funcionam em desktop/mobile/teclado e cliques de desenho não reiniciam zoom/enquadramento.

### Revisão Humana

A intenção, requisitos e plano foram aprovados explicitamente. Implementação local concluída e verificada até 2026-10-14: 133 testes frontend, 417 verificações de banco, 4 jornadas E2E, build e lint passaram. Resultado e ressalvas em `tasks/plan.md`; não há deploy remoto. Regiões principais podem ser publicadas sem subregiões, e cada cadastro manual posterior é salvo/disponibilizado individualmente após commit.

<details>
<summary>Histórico do fluxo anterior de subdivisões (substituído; não usar como requisito vigente)</summary>

## Histórico: Subdivisões por Linhas de Corte

### Objetivo e Intenção Confirmada

Permitir que a liderança da cidade crie subdivisões traçando linhas de corte diretamente no mapa, além da geração automática existente. O desenho deve permitir limites personalizados, como as quatro áreas da imagem apresentada na entrevista, sem alterar o contorno da região. A imagem é referência de interação e resultado, não fonte de coordenadas nem modelo obrigatório de quatro subdivisões.

Neste fluxo, a "divisão" mencionada na entrevista corresponde à `Region` do domínio; cada área resultante corresponde a uma `Subdivision`. A capacidade permanece no módulo `territory-map`.

Escopo confirmado:
- Manter as duas opções: geração automática e desenho manual.
- Desenhar linhas de corte, e não polígonos fechados independentes.
- Concluir cada corte para separar uma área em duas imediatamente, sem lacunas nem sobreposições.
- Usar o contorno da região ou os limites resultantes de cortes anteriores como extremidades.
- Começar pela região inteira ou cortar uma subdivisão já gerada automaticamente.
- Desenhar por pontos sucessivos no contexto da região selecionada, por exemplo `GT UEM, Vila esperança e região`, sem afetar outras regiões.
- Preservar permissões, validação geométrica, publicação e proteção das inscrições existentes.

### Regras de Interação

- Decisão confirmada: o trajeto é uma polilinha criada por pontos sucessivos no mapa da região selecionada, não um gesto contínuo de desenho livre. Pode ter curvas aproximadas por vários segmentos.
- Cada corte atua sobre uma área selecionada ou, no primeiro corte, sobre a região inteira. A opção regional substitui a partição existente na prévia e permite atravessar as bordas automáticas. Depois disso, novos cortes atuam sobre uma das áreas manuais resultantes.
- "Imediatamente" significa atualizar a prévia no mapa ao concluir um corte válido; não significa publicar ou alterar inscrições automaticamente.
- Decisão confirmada: permitir desfazer o último corte da sessão e manter o resultado em edição até a ação explícita de salvar, separada da prévia. Cancelar a edição restaura o último estado persistido.
- Decisão confirmada: subdivisões resultantes de cortes manuais podem ter áreas desiguais, inclusive fora da faixa de ±15%. O desvio não bloqueia salvar nem publicar essas partições; a geração automática mantém a exigência de equilíbrio.
- Cortes intermediários podem aparecer na prévia e ser salvos quando satisfizerem as demais validações. A prévia por si só não altera a configuração persistida nem o mapa publicado.

### Fluxo da Liderança

1. Selecionar uma região, por exemplo `GT UEM, Vila esperança e região`, e escolher geração automática ou desenho por cortes. Destacar a região selecionada como contexto da edição. A geração automática conserva sua configuração atual de quantidade.
2. O modo manual oferece a região inteira como alvo inicial, inclusive quando houver subdivisões automáticas. Antes de concluir o primeiro corte regional, elas permanecem como referência; confirmar a substituição para produzir uma nova partição na prévia. Também é possível selecionar uma subdivisão individual e preservar as demais. Nenhuma dessas ações grava o mapa publicado.
3. Iniciar o corte no limite da área-alvo, marcar pontos intermediários e terminar em outro ponto do limite. Um limite compartilhado com outra subdivisão também é uma extremidade válida.
4. Antes de concluir, visualizar o trajeto e os pontos definidos, poder remover o último ponto ou cancelar o corte em andamento.
5. Concluir o corte: se válido, substituir somente a área-alvo por duas áreas na prévia e atualizar números, quantidade, áreas e desvios; se inválido, manter a partição anterior e indicar o motivo.
6. Repetir os cortes sobre qualquer área resultante dentro da mesma região selecionada. A quantidade manual decorre dos cortes aceitos; não depende de uma quantidade previamente escolhida.
7. Permitir desfazer o último corte da sessão antes de salvar, restaurando a geometria e os identificadores da prévia anterior.
8. Salvar explicitamente a partição completa da região quando todas as validações forem satisfeitas. Publicar pelo fluxo existente, em ação distinta.

Alternar a ferramenta não deve descartar edições. Gerar automaticamente sobre uma prévia ou configuração existente é uma ação de substituição e exige confirmação explícita, preservando as regras atuais para mapas publicados e inscrições.

### Regras de Corte e Integridade

- Ajustar as extremidades ao limite da área-alvo quando estiverem dentro da tolerância visual definida; mostrar o ponto efetivamente utilizado. Fora dessa tolerância, rejeitar em vez de prolongar o corte silenciosamente.
- A tolerância visual em pixels e a precisão geométrica em unidades métricas são conceitos distintos. Seus valores devem ser definidos e testados na fase de planejamento, sem relaxar as tolerâncias de integridade atuais.
- Aceitar somente um trajeto contínuo, sem autointerseção, de comprimento positivo, com extremidades distintas no limite e interior contido na área-alvo.
- Rejeitar cortes que apenas tangenciem o limite, percorram uma borda, saiam e retornem à área ou gerem um número de áreas diferente de dois. No corte individual, não atravessar outra subdivisão; na substituição regional inicial, bordas automáticas internas são ignoradas e o contorno externo continua obrigatório.
- Cada resultado deve ser um `Polygon` ou `MultiPolygon` válido, não vazio e de área positiva. A união dos resultados deve reproduzir a área-alvo; seus interiores não podem se sobrepor.
- No corte individual, preservar as demais subdivisões. Na substituição regional confirmada, substituir todas as subdivisões daquela região na prévia. Sempre preservar a geometria da região, as regiões vizinhas e o perímetro urbano.
- Geometrias multipartes e com buracos não podem ser simplificadas para eliminar componentes. Se o corte não puder produzir exatamente duas áreas válidas respeitando essa geometria, rejeitá-lo sem alterações.
- Validar a partição inteira no banco antes de persistir: contenção, cobertura, ausência de sobreposição e limites de entrada; exigir equilíbrio de área para a geração automática, mas não para a partição resultante de cortes manuais. A validação no navegador é apenas antecipação para a interface.
- Preservar o limite existente de até 50 subdivisões por região, sem permitir ultrapassá-lo por cortes sucessivos; preservar também os limites vigentes de tamanho de entrada e número de vértices.
- Números são rótulos de exibição, não identificadores persistentes. Preservar IDs das áreas não alteradas; o tratamento dos IDs da área cortada e de suas sucessoras deve respeitar o histórico e os vínculos existentes, sem realinhamento implícito.

### Equilíbrio de Área e Estados Intermediários

A geração automática mantém a exigência atual de ±15%. No desenho manual, mostrar área e desvio de todas as subdivisões em relação à média da região para a quantidade resultante, apenas como informação, sem indicar erro ou bloquear a operação por desigualdade.

Uma partição manual geometricamente válida pode ser salva e publicada mesmo com áreas muito desiguais, desde que cumpra as demais validações e o fluxo vigente de publicação e realocação. Isso também vale quando a liderança começa com subdivisões automáticas e depois faz cortes manuais; o equilíbrio inicial não restringe o resultado dos cortes.

A exceção foi autorizada pelo usuário em 2026-10-13. Sua aplicação deve ser reconhecida e validada no banco tanto no salvamento quanto na publicação, sem permitir que a geração automática dispense sua própria regra. O mecanismo técnico para distinguir essas operações será definido no planejamento; não basta remover o bloqueio na interface.

### Persistência, Permissões e Inscrições

- Somente a liderança da cidade pode executar a operação, com autorização no banco. Participantes e líderes de setor não recebem acesso de escrita, inclusive por chamada direta ao serviço.
- Persistir a nova partição em uma operação atômica: ou todas as áreas são aceitas, ou a configuração anterior permanece intacta.
- Cortes aumentam a quantidade de subdivisões. O fluxo atual de edição de vértices, que pressupõe a mesma quantidade de áreas, não deve ser tratado como suficiente sem adaptar e validar a operação de mudança de partição na fase técnica.
- Alterações de mapa publicado devem seguir o fluxo administrativo vigente, sem editar silenciosamente o mapa disponível aos participantes.
- Uma área com inscrições ativas não pode ser dividida de forma persistida até haver realocação válida pelo fluxo vigente. A prévia pode ser desenhada, mas não muda inscrições nem a publicação.
- Não escolher destinos de participantes com base em proximidade, número de área ou posição geográfica inferida. Realinhamentos exigem destinos explícitos e devem preservar o histórico.
- Decisão aprovada em 2026-10-13: bloquear a publicação de um corte quando a área original tiver qualquer ato vinculado, inclusive cancelado, sem mover ou apagar o ato automaticamente. A prévia não altera esses vínculos.
- Em erro de rede, autorização, validação ou conflito de edição, manter o último estado persistido; a interface não deve anunciar sucesso sem confirmação do servidor. Detectar estado desatualizado e impedir sobrescrita silenciosa.

### Interface e Acessibilidade

Manter o mapa e o padrão visual existentes. Oferecer escolha clara entre geração automática e cortes manuais; mostrar a área selecionada, a linha em andamento e as áreas resultantes sem depender exclusivamente de cor.

Controles de concluir, cancelar, remover ponto, desfazer e salvar devem ter nomes acessíveis, estados habilitado/desabilitado coerentes e foco visível. Não acionar cortes ao navegar, arrastar ou ampliar o mapa. Suportar mouse e toque nos layouts desktop e mobile; os controles devem ser operáveis por teclado e o trajeto precisa de um meio equivalente de definição sem exigir exclusivamente mouse.

Mensagens devem indicar motivos acionáveis, como corte fora da área, extremidade fora do limite, resultado sem separação, limite de quantidade atingido ou inscrições que exigem realocação. Desequilíbrio de área é bloqueante somente no fluxo automático, nunca no resultado de cortes manuais. Informar progresso e erros sem perder o desenho em andamento. Publicação e salvamento permanecem visualmente distintos.

### Stack, Estrutura e Estilo Aplicáveis

Esta extensão herda as seções de comandos, estrutura, estilo e limites do módulo. Dependências instaladas relevantes: React 19.3.0, TypeScript 5.9.3, Vite 6.4.4, Leaflet 1.9.4, React Leaflet 5.0.0 e Leaflet-Geoman Free 2.20.2. A existência do plugin não comprova suporte à operação de corte desejada; verificar sua capacidade antes de escolhê-lo para essa operação. Não presumir recursos pagos nem adicionar dependências nesta fase.

Superfícies existentes para o planejamento posterior:
- `src/features/territory-map/components/CityMap.tsx` e seu teste: renderização e interação do mapa.
- `src/features/territory-map/lib/territoryService.ts` e seu teste: integração e validação das respostas do serviço.
- `supabase/migrations/` e `supabase/tests/`: operações espaciais, autorização, atomicidade e proteção de inscrições.
- `e2e/`: fluxos completos de liderança e participante. Reutilizar testes e helpers adequados antes de criar arquivos.

Manter nomes de código em inglês, interface em português, TypeScript estrito e o formato ilustrativo de `MapSubdivision` já descrito neste documento. GeoJSON usa longitude/latitude; Leaflet exige conversão explícita quando recebe latitude/longitude. O algoritmo, contrato técnico e eventuais migrações serão definidos somente após aprovação desta especificação.

### Estratégia de Testes e Comandos

- Vitest: corte reto e com vários segmentos, cortes sucessivos, alvo automático, bordas compartilhadas, entradas inválidas, multipartes/buracos, desfazer, numeração e preservação das áreas não alteradas.
- React Testing Library: seleção de modo e alvo, concluir/cancelar/remover ponto, prévia, bloqueios, confirmação de substituição, erros e nomes acessíveis.
- Supabase/PostGIS: partição completa, ausência de sobreposição, equilíbrio obrigatório na geração automática, salvamento/publicação de áreas manuais desiguais, cortes sobre áreas automáticas, aumento de quantidade, limites de entrada, escrita atômica, concorrência, autorização e preservação de inscrições/histórico.
- Playwright: começar sem subdivisões e chegar a quatro áreas por três cortes; cortar uma subdivisão automática; salvar e recarregar; rejeitar corte inválido; bloquear persistência com inscrições; confirmar que participantes continuam vendo somente o mapa vigente.
- Verificação em navegador desktop e mobile: desenho, toque, zoom, foco, estados intermediários e ausência de sobreposição dos controles.
- Não reduzir a cobertura existente, ignorar falhas ou remover testes para acomodar o novo fluxo. Não estabelecer um percentual de cobertura novo sem acordo.

Comandos de verificação para a implementação futura:

```sh
npm run test -- --run src/features/territory-map
npm run typecheck
npm run test -- --run
npm run build
npm run lint
npm run test:db
npm run test:e2e
```

Os testes de banco e E2E exigem Supabase local iniciado e dados de teste apropriados. Desenvolvimento: `npm run dev -- --host 127.0.0.1 --port 5174`; usar outra porta caso já esteja ocupada. Esses comandos não significam que a extensão já foi implementada ou verificada.

### Limites da Extensão

- **Sempre:** preservar geração automática, limites pais, atribuição do mapa, autorização no banco, validação independente do cliente, atomicidade, histórico e confirmação explícita antes de substituir trabalho existente.
- **Perguntar antes:** dispensar equilíbrio de área na geração automática ou nas regiões, alterar permissões/inscrições/publicação, aumentar limites, adicionar dependências, mudar schema ou definir um corte que atinja várias áreas ao mesmo tempo. A exceção de equilíbrio para cortes manuais já está autorizada.
- **Nunca:** publicar ao concluir um corte, realocar participantes silenciosamente, alterar a região para acomodar o desenho, persistir partição parcial ou aceitar entrada somente por ter passado na interface.

Fora do escopo: desenho livre contínuo, importação da imagem como geometria, união de subdivisões, corte em lote de várias áreas, redesenho da região principal, mudança de permissões e substituição da geração automática.

### Critérios de Aceite da Extensão

1. A liderança encontra geração automática e desenho por cortes; os fluxos automáticos atuais continuam funcionando.
2. Ao selecionar GT UEM sem subdivisões, três cortes válidos por pontos sucessivos podem produzir quatro áreas na prévia, sem modificar o contorno da região nem as demais regiões. O mesmo fluxo deve funcionar em qualquer região selecionada autorizada, sem tratamento exclusivo para GT UEM.
3. Com subdivisões automáticas, um corte válido aumenta a quantidade em uma e preserva geometrias e IDs das áreas não alteradas.
4. Uma linha com pontos intermediários pode separar uma área em duas; seus extremos podem usar o contorno da região ou uma borda compartilhada criada anteriormente.
5. Corte inválido não altera a partição anterior e exibe o motivo. Cancelar/remover ponto/desfazer restauram o estado correspondente.
6. Uma partição resultante de cortes manuais com áreas fora de ±15% pode ser salva e publicada quando cumprir as demais regras, inclusive se partir de subdivisões automáticas. A geração automática continua rejeitando resultados fora da faixa vigente.
7. Salvar uma partição válida confirma o resultado no servidor e o preserva após recarregar; falha não produz gravação parcial.
8. O banco rejeita entradas adulteradas e operações de participantes ou líderes de setor, independentemente da interface.
9. Dividir área com inscrições ativas não persiste nem publica sem realocação explícita válida; falhas preservam mapa, inscrições e histórico.
10. O mapa publicado permanece inalterado enquanto houver apenas edição ou prévia; a publicação usa o fluxo vigente.
11. O limite de 50 subdivisões e os limites de entrada continuam efetivos no cliente e no banco.
12. Mouse, toque e acesso por teclado são verificáveis; controles não interferem na navegação do mapa, e números/estados não dependem apenas de cor.
13. Com subdivisões automáticas existentes, selecionar a região inteira permite traçar uma linha atravessando suas bordas internas; a conclusão confirmada substitui a partição por duas áreas na prévia. Desfazer restaura a partição anterior, e o banco publicado permanece intacto.

### Registro de Aprovação Humana

1. **Equilíbrio de área, confirmado em 2026-10-13:** permitir áreas manuais desiguais, sem bloqueio de ±15% no salvamento ou na publicação; manter a regra na geração automática e as demais validações em todos os modos.
2. **Desenho e contexto, confirmados em 2026-10-13:** desenho por pontos sucessivos na região selecionada, como GT UEM; os cortes criam subdivisões dentro dessa região e preservam seu contorno externo.
3. **Desfazer e salvamento, confirmados em 2026-10-13:** permitir desfazer o último corte da sessão e salvar explicitamente, em ação separada da prévia. Salvar não publica automaticamente.

4. **Especificação aprovada em 2026-10-13:** o usuário autorizou começar planejamento e implementação. Elaborar o plano e as tarefas como próxima fase; revisar esses artefatos com o usuário antes de executar, conforme o fluxo SDD.

### Atualização Aprovada: Áreas Manuais Sobrepostas

Em 2026-10-13, o usuário autorizou uma subárea manual cruzar/sobrepor outras subáreas, mantendo a seleção exclusivamente na região colorida correspondente. Essa exceção substitui a exigência de ausência de sobreposição somente no modo `area` de desenho manual, sem alterar a geração automática nem autorizar atravessar o contorno regional.

- Manter a linha de corte existente e acrescentar a opção `Área manual (permite sobreposição)` no seletor.
- Nesse modo, pelo menos três pontos formam um polígono fechado ao concluir. O usuário não precisa iniciar ou terminar na borda, nem apagar as subáreas existentes.
- Validar que o polígono não tem autointerseções; recortar sua geometria pela interseção com a região selecionada. Rejeitar resultado vazio ou inválido. O resultado final nunca inclui trechos de outra região.
- Preservar todas as áreas existentes e acrescentar a nova área na prévia, mesmo com sobreposição. Desfazer restaura a prévia anterior.
- Permitir mudar para esse modo sem apagar os pontos em andamento. Informar a região selecionada sem somar áreas sobrepostas como se representassem sua área total.
- A autorização e os limites de entrada continuam obrigatórios no banco. O contrato de corte aceita `mode: 'area'`; ausência do campo mantém a operação anterior de linha, para compatibilidade.
- Salvar/publicar ainda são etapas futuras. Seus validadores deverão reconhecer a exceção somente para áreas manuais comprovadas por replay, mantendo inscrições, histórico e bloqueio de atos nas áreas efetivamente alteradas.

Verificação desta mudança: o contorno real de 18 pontos que havia sido rejeitado foi aceito no navegador como área manual recortada em GT UEM, criando uma quinta área na prévia. Desfazer restaurou as quatro originais; nenhuma publicação foi alterada.

</details>
