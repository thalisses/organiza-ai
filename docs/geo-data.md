# Dados geoespaciais: perímetros urbanos oficiais de Maringá

## Escopo selecionado

Por decisão do usuário em 2026-10-12, o mapa do MVP usa os sete polígonos publicados na camada oficial “Perímetro Urbano” de 20/07/2026: Distrito Sede, Iguatemi, Floriano, Jardim São Domingos, Venda Duzentos, Projeto Reviver e ZEDE. São recortes urbanos legais separados, não o perímetro municipal rural do IBGE.

## Fonte candidata

- Página oficial da Prefeitura, seção “Mapas - Geoprocessamento”: http://www3.maringa.pr.gov.br/site/index.php?sessao=422d107f31mg42
- Camada publicada: [Perímetro Urbano (20/07/2026)](https://www3.maringa.pr.gov.br/sistema/arquivos/geo/doc/shape/perimetro_urbano_2026_07_20.zip)
- Base legal indicada no portal: LC 1461/2024, original e consolidada; a consolidação lista a inclusão da ZEDE pela LC 1505/2025.
- LC 1461/2024 original: https://www3.maringa.pr.gov.br/sistema/arquivos/geo/doc/leis/lc_1461_2024_perimetro_urbano_original_2024_10_17.pdf
- LC 1461/2024 consolidada: https://www3.maringa.pr.gov.br/sistema/arquivos/geo/doc/leis/7365291_anexo_lu_03_lc_1461_2024_perimetro_urbano_consolidada_2.pdf

## Inspeção técnica

Escopo do mapa definido pelo usuário em 2026-10-12: usar o perímetro urbano oficial completo para o desenvolvimento do MVP.

- O `.prj` e o metadata identificam SIRGAS 2000 / UTM 22S, EPSG:31982, em metros. A lei também especifica SIRGAS 2000 e fuso 22 sul.
- O pacote ZIP foi publicado em 20/07/2026 e contém sete polígonos: perímetro do Distrito Sede, Iguatemi, Floriano, Jardim São Domingos, Venda Duzentos, Projeto Reviver e ZEDE.
- A feição do Distrito Sede tem `DESCR_LOT = PERÍMETRO URBANO DO MUNICÍPIO DE MARINGÁ`, tipo Polygon válido, 3.369 vértices e perímetro de 82.309,78 m em EPSG:31982. O Anexo I da LC 1461/2024 informa o mesmo perímetro (82.309,78 m).
- Área da feição principal: 176,0097 km² planar em EPSG:31982; 176,1096 km² geodésicos em SIRGAS 2000. O Anexo I extraído do PDF mostra `17.6600,97 ha`, cuja pontuação/formatação precisa ser confirmada visualmente no documento original antes de afirmar concordância de área.
- As sete feições do app foram transformadas de EPSG:31982 para GeoJSON longitude/latitude WGS84 (EPSG:4326). `src/data/maringa-urban-boundary.geojson` contém os sete Polygon válidos com área, CRS e atributo legal-fonte preservados.
- Em runtime, o GeoJSON é carregado como asset estático; a validação exige as sete áreas, tipo Polygon, CRS de origem EPSG:31982, coordenadas EPSG:4326 e extensão esperada. Leaflet é lazy-loaded somente na sessão autenticada.
- O mapa foi conferido em Leaflet sobre tiles OSM em viewport 375px e desktop, inclusive após redimensionar: todos os sete polígonos permanecem no frame, os tiles carregam e não há overflow horizontal.
- Os tiles usam `https://tile.openstreetmap.org/{z}/{x}/{y}.png` e mostram atribuição OSM. Seguir também a [política oficial de uso de tiles](https://operations.osmfoundation.org/policies/tiles/): sem prefetch/download em lote, conservar o Referer e respeitar cache; o serviço público não oferece SLA.
- A união dos sete polígonos do pacote é válida; sua área planar em EPSG:31982 é 192,6642 km². Essa união não é usada no mapa atual.
- O metadata `.shp.xml` tem SyncDate/ModDate 04/01/2023 e informa 29 feições, enquanto o Shapefile publicado em 2026 contém sete registros. O metadata lateral está desatualizado e não deve ser usado como inventário do pacote atual.
- Os comprimentos medidos no Shapefile coincidem ou ficam muito próximos dos memoriais da LC 1461 para Distrito Sede (82.309,78 m), Iguatemi (10.692,84 m contra 10.694,42 m), Floriano (16.647,30 m contra 16.647,78 m), Jardim São Domingos (4.327,10 m contra 4.327,14 m) e Venda Duzentos (4.897,80 m contra 4.897,84 m).
- O campo DBF `ULT_LEI` da feição principal cita LC 1424/2024, enquanto a LC 1461/2024 é a norma publicada como instituidora dos perímetros e seu Anexo I coincide no comprimento. Confirmar com a Prefeitura a interpretação/atualização desse atributo antes da publicação.

## Prova preliminar de partições (T08)

Em 12/10/2026, o GeoJSON completo foi carregado em uma consulta somente de leitura no PostGIS 3.3.7, transformado de EPSG:4326 para EPSG:31982 e unido para a medição. A união dos sete polígonos é válida e mede 192.664.215,74 m². Um experimento de faixas paralelas com cortes quantílicos por bisseção nos eixos UTM X e Y atingiu desvio máximo arredondado de 0,0001% para contagens 2, 3, 4, 5, 7 e 10; as geometrias de saída passaram `ST_IsValid` e a diferença simétrica de cobertura foi no máximo 0,000001 m².

Essa prova histórica testou faixas como gerador de **regiões** e não foi adotada para elas; regiões agora são desenhadas manualmente. O snap de 1 cm não será usado, pois alterou 233,106176 m² do limite.

## Geração e edição de subdivisões

O PostGIS gera subdivisions por faixas no eixo UTM mais longo, calculando cortes de área-alvo por bisseção. A prova sobre a união oficial completa passou para contagens 2, 3, 5, 7 e 10: todas válidas, dentro de ±15%, contidas no pai, sem overlaps e com diferença de cobertura inferior a 0,01 m². A RPC aceita uma região pai específica e persiste candidatos aprovados; se qualquer critério falhar, a transação aborta e preserva o conjunto de subdivisões anterior.

O mapa renderiza as subdivisões numeradas e deixa somente a liderança da cidade editar vértices pelo Geoman. O salvamento revalida contagem, validade, containment, balanceamento, overlaps e cobertura no PostGIS, atualizando as linhas existentes sem trocar seus IDs. A geometria de edição continua local até o botão de salvar; líderes de setor são negados pelo banco mesmo quando associados à região.

## Rascunho manual no mapa

O mapa permite à liderança da cidade desenhar Polygon/MultiPolygon de regiões, agrupar componentes, editar cores, validar no PostGIS e salvar drafts transacionais com IDs estáveis. Após selecionar uma região, a liderança define a quantidade de subdivisões; o PostGIS gera candidatos balanceados, o mapa os numera e permite ajustar vértices com pontos Geoman. O salvamento das edições preserva os IDs e revalida geometrias no banco. A publicação inicial valida toda a hierarquia; o RPC RLS carrega regiões e subdivisões publicadas para participantes em modo somente leitura. A substituição de um mapa publicado está bloqueada até existir uma política de realinhamento. A versão gratuita do Geoman não oferece containment durante o desenho; o banco é a fronteira de segurança.

A camada `public.urban_perimeters` guarda os sete Polygon oficiais, imutáveis pela Data API e legíveis apenas por usuários autenticados. As tabelas `region_sets`, `regions`, `subdivisions` e `sector_leader_regions` definem IDs estáveis, multipartes e atribuições N:N. As RPCs de geração/salvamento validam parent, validade, ±15%, overlaps e cobertura em EPSG:31982; somente a liderança da cidade pode editar subdivisões. A migration mantém a cópia PostGIS fiel ao GeoJSON-fonte. Publicação inicial e leitura do mapa publicado estão implementadas; substituição segura ainda não.

Turf calcula área geodésica sobre as sete feições: 193.228.800,22 m². PostGIS mediu 192.772.748,79 m² para a união geodésica; a diferença de aproximadamente 0,24% vem do método esférico de Turf versus o elipsoide usado pelo PostGIS. A soma das feições excede a união em apenas 12 m². O desvio mostrado no mapa é, portanto, uma estimativa; a publicação deve recalcular ±15%, contenção, sobreposição e cobertura no PostGIS em CRS métrico.

## Pendências antes da publicação

- **Licença e atribuição:** a página e o metadata não apresentam licença de reutilização ou instrução de atribuição para redistribuição do shapefile/GeoJSON. Confirmar os termos com a Prefeitura antes de Vercel preview/público.
- **Projeto Reviver (fora do escopo atual):** a feição mede aproximadamente 123.000 m² e 2.805,99 m de perímetro. O Anexo VI da LC 1461 consolidada informa 121.000 m² e perímetro estimado de 1.558,50 m; suas coordenadas não estão especificadas no texto. Não integrar esse núcleo sem esclarecimento oficial.
- **Campo de lei do vetor:** `ULT_LEI` da feição principal diz LC 1424/2024, embora o perímetro seja instituído/descritos na LC 1461/2024; o comprimento coincide com o Anexo I da LC 1461, mas a Prefeitura deve confirmar o significado do atributo antes da publicação.
- **Conferência cartográfica/legal:** o vetor foi validado topologicamente e visualizado sobre OSM; falta conferência manual do arquivo contra o mapa legal em GIS com a Prefeitura/planejamento urbano.
- Não substituir nenhuma dessas áreas pelo perímetro municipal do IBGE.

## Próxima validação necessária

Solicitar à Prefeitura (Geoprocessamento/Planejamento Urbano) os termos de licença/atribuição e confirmação do campo `ULT_LEI`; conferir visualmente a pontuação/valor de área no Anexo I e validar as sete geometrias convertidas contra o mapa legal em GIS. O mapa local usa os sete polígonos, como solicitado; preview público aguarda essas confirmações.