# Mapa de Capacidades: Organiza AI

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `identity-access` | Cadastro, login, perfis de participante/liderança e controle de permissões | — |
| `territory-map` | Cidade piloto de Maringá, regiões coloridas e subdivisões numeradas; seleção e inscrição de participantes por região | `identity-access` |
| `acts` | Cadastro de atos por região, com data, horário e tipo; inscrição e visualização da lista de participantes | `identity-access`, `territory-map` |
| `material-points` | Cadastro e consulta de locais de retirada, materiais/temas e horários disponíveis | `identity-access`, `territory-map` |

## Ordem de construção

`identity-access` → `territory-map` → `acts` e `material-points` (podem avançar em paralelo).
