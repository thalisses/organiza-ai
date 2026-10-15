# Preparar o deploy em Produção

O destino escolhido é Produção, sem exigir um Preview antes. O projeto Supabase de Produção já está vinculado a este workspace; as migrations foram aplicadas e os sete perímetros foram conferidos. O Auth permite cadastro, não exige confirmação de e-mail por decisão operacional, e já tem Site URL/redirect configurados. O SMTP está preenchido parcialmente, mas aguarda credenciais Brevo e autenticação DNS do remetente. Ainda faltam a conta inicial de liderança, Vercel, domínio final, deploy e testes manuais.

## O que falta

- [ ] **Bloqueio para divulgação pública:** confirmar com a Prefeitura licença/atribuição do mapa e fazer a conferência GIS. Detalhes em [geo-data.md](geo-data.md).
- [x] Criar o projeto Supabase de Produção separado, aplicar as migrations e confirmar os sete perímetros.
- [ ] Concluir SMTP de produção no Brevo e testar entrega. A confirmação de e-mail está desativada por decisão operacional; contas podem entrar sem verificar o endereço.
- [ ] Criar a conta inicial de liderança no projeto de Produção usando [leader-bootstrap.md](leader-bootstrap.md) e credencial administrativa apenas no SQL Editor.
- [ ] Configurar variáveis Production, domínio e branch de produção na Vercel; o primeiro deploy será público.
- [ ] Executar os testes manuais e o checklist pós-deploy desta página.

## 1. Criar o Supabase de Produção

No [painel Supabase](https://supabase.com/dashboard), crie um projeto exclusivo para Produção, por exemplo `organiza-ai-prod`. Não aponte produção para o banco local nem reutilize um projeto de teste. O repositório está configurado para PostgreSQL 17. Escolha uma região adequada ao piloto e guarde a senha do banco num gerenciador de senhas; ela não é variável do site.

O plano Free pode servir para uma primeira operação pequena, mas projetos inativos podem ser pausados e o plano não inclui backups automáticos diários. Para um serviço público que precise permanecer disponível e proteger dados operacionais, avalie um plano pago e uma política de backup antes da divulgação.

### Configurar Auth

Em **Authentication → Sign In / Providers → Email**:

- Permita novos cadastros.
- **Confirm email está desativado por decisão operacional:** cadastros podem entrar sem validar o endereço. Se essa decisão mudar, ative a opção antes de abrir o cadastro público e teste o fluxo de confirmação.
- Não habilite login anônimo.
- Configure um SMTP próprio em **Authentication → SMTP Settings**. O SMTP padrão do Supabase é restrito a endereços da equipe e tem limite baixo; não serve para enviar confirmações ao público. Um provedor pode ter cota gratuita, mas confira limites e entregabilidade. Configure SPF/DKIM/DMARC para o domínio de envio quando o provedor oferecer.
- Revise o template **Confirm signup** e mantenha o link `{{ .ConfirmationURL}}` funcional. Senhas SMTP ficam somente no painel Supabase, nunca em `VITE_*` ou no repositório.

**Mensagem de cadastro:** se a confirmação for ativada no futuro, o `signUp` pode retornar sem sessão. O app já orienta a pessoa a confirmar o e-mail antes de entrar; o retorno do link ainda precisará ser testado no domínio final.

Em **Authentication → URL Configuration**:

- **Já configurado:** Site URL `https://organiza-ai-esquerda.vercel.app` e o mesmo endereço como redirect permitido exato, sem curingas. Atualize ambos se o domínio público mudar.
- Não permita URLs de Preview, localhost ou domínios de terceiros neste projeto produtivo, salvo necessidade explícita e revisada.

### Aplicar o banco

As migrations criam o schema, RLS/grants, PostGIS, cidade piloto e perímetros. Confira duas vezes que o projeto/ref selecionado é o de Produção e que o banco não contém dados a preservar. A CLI Supabase já está instalada neste workspace.

No terminal do projeto:

```sh
supabase login
supabase projects list
supabase link --project-ref REF_DO_PROJETO_PRODUCTION
supabase migration list --linked
supabase db push --dry-run --linked
```

Revise a lista de migrations e confirme visualmente o nome/ref do projeto no painel. Se o destino não for um banco novo/vazio ou a lista parecer inesperada, pare e investigue; não use `db reset` no remoto. Depois de confirmar que este é o banco produtivo pretendido, aplique e confira o histórico:

```sh
supabase db push --linked
supabase migration list --linked
```

Não use `--include-seed` sem revisar os dados de seed. As tabelas públicas têm grants explícitos nas migrations; não habilite permissões amplas para “fazer a API funcionar”. O Data API e as políticas RLS/grants são controles separados.

Após a aplicação, `supabase db advisors --linked` reportou um aviso intencional para `public.set_sector_leader`: a função `SECURITY DEFINER` concede execução somente a `authenticated` e valida no banco o papel de liderança da cidade. O teste [identity_role_assignment.test_test.sql](../supabase/tests/identity_role_assignment.test_test.sql) cobre as permissões e recusas; preserve essas verificações ao revisar o aviso.

No SQL Editor do projeto de Produção, confirme que os sete perímetros chegaram:

```sql
select count(*) as total_perimetros
from public.urban_perimeters;
```

O resultado esperado é `7`. Antes de liberar cadastro público, crie a conta da liderança inicial com o e-mail correto, confirme-o pelo fluxo do Auth e execute o bootstrap de [leader-bootstrap.md](leader-bootstrap.md) no SQL Editor. Não use a chave publishable para promover papéis, nem compartilhe credenciais administrativas.

## 2. Configurar a Vercel para Production

O [vercel.json](../vercel.json) já define `npm ci`, `npm run build`, saída `dist/` e fallback SPA. O `package.json` exige Node.js 24 ou superior dentro das versões suportadas; em **Project Settings → Build and Development Settings**, selecione Node.js 24.x.

No projeto Vercel, em **Settings → Environment Variables**, crie estas duas variáveis com escopo **Production**:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL HTTPS do projeto Supabase de Produção |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave `sb_publishable_...` desse mesmo projeto |

Encontre os valores em **Connect** ou **Project Settings → API Keys** no Supabase. Essas duas variáveis são compiladas dentro do JavaScript do navegador. A publishable key é pública e deve ser protegida por RLS/grants; nunca use `sb_secret_...`, `service_role`, senha do banco, token Supabase ou token Vercel no frontend.

Configure a branch de produção correta (normalmente `main`) e conecte o repositório ao projeto Vercel. Configure as duas variáveis Production antes de concluir o primeiro build público. O `vercel.json` fixa `npm ci`, `npm run build`, saída `dist/` e fallback SPA.

**Primeiro deploy:** em um projeto Vercel novo, o primeiro deployment é Production mesmo se partir de outra branch ou sem `--prod`. Como o objetivo agora é Produção, confirme que o domínio e as variáveis já são os corretos antes de clicar em **Deploy**. Não conecte um repositório se não estiver pronto para tornar o primeiro deployment público.

Associe o domínio final ao projeto Vercel, conclua a configuração DNS indicada no painel e aguarde o certificado HTTPS. Em **Supabase → Authentication → URL Configuration**, use o mesmo domínio como Site URL e Redirect URL. O domínio `vercel.app` pode continuar disponível, mas não deve substituir o domínio público escolhido sem decisão explícita.

Nenhum deploy remoto foi feito até agora: não há CLI Vercel instalada nem projeto vinculado a este workspace.

## 3. Gates antes e depois do deploy

Antes de criar o deployment público:

```sh
npm run test -- --run
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
```

No domínio de Produção, imediatamente após o deploy:

- [ ] `/` carrega autenticação e assets; atualizar diretamente a página inicial e caminhos do cliente não retorna 404.
- [ ] Cadastro envia o e-mail de confirmação; só depois de confirmá-lo o usuário consegue entrar. Teste também um endereço inválido e uma tentativa de login antes da confirmação.
- [ ] A conta participante não vê controles de liderança; a liderança de cidade e líderes de setor têm apenas permissões esperadas.
- [ ] Teste agenda/inscrição/cancelamento, privacidade do roster e pontos de material na lista e no mapa.
- [ ] Console e rede não mostram erros inesperados ou credenciais privilegiadas; confirme que o app usa a URL e a publishable key do projeto de Produção.
- [ ] Domínio, TLS, URL de Auth e link do e-mail de confirmação correspondem ao domínio público.
- [ ] Verifique logs/erros no Vercel e Supabase; mantenha o deployment anterior disponível para rollback.

## 4. Antes de abrir para usuários

O build verde não basta para abrir o site ao público. O checklist ainda registra:

- [ ] Prefeitura: licença/atribuição e comparação manual das sete geometrias com o mapa legal; esclarecer o atributo `ULT_LEI` e a divergência do Projeto Reviver. Este é um bloqueio para publicar o mapa. Veja [geo-data.md](geo-data.md).
- [ ] Território: validar no mapa as partições e a recusa de geometrias inválidas; testar edição/atribuição pela liderança e realinhamento de participantes.
- [ ] Atos: testar criação, edição e cancelamento nos dois escopos; inscrição em ato fora da subdivisão própria; comparar roster como líder de cidade, líder atribuído, não atribuído e participante.
- [ ] Pontos: testar criação/edição/exclusão com várias janelas e comparar detalhes em lista/mapa no desktop e celular.
- [ ] Acessibilidade: revisar teclado, foco e leitor de tela manualmente.
- [ ] Definir retenção de dados pessoais e a política de suporte/remoção de contas.
- [ ] Confirmar plano Supabase: Free pode pausar após inatividade e não inclui backups automáticos diários; configure backup/restore apropriado ao nível de disponibilidade esperado.
- [ ] Fazer uma janela de lançamento com responsável disponível para monitorar e plano de rollback. Vercel permite voltar ao deployment anterior; migrations de banco precisam de plano próprio e não devem ser revertidas com `db reset`.

## Referências

## Referências

- [Guia de perímetro e pendências legais](geo-data.md)
- [Bootstrap seguro da liderança](leader-bootstrap.md)
- [Vercel: `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel: ambientes e primeiro deploy](https://vercel.com/docs/deployments/environments)
- [Supabase: chaves de API](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase: configuração do Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase: SMTP customizado](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates)