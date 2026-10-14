# Organiza AI

Aplicação web do piloto de organização territorial de Maringá/PR.

## Desenvolvimento local

Requer Node.js 24 e npm 11.19.0.

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL do projeto Supabase e a chave publishable. Nunca use chave `sb_secret_`, `service_role` ou senha de banco no frontend.

## Deploy

Configuração de build, ambientes Preview e verificações antes da publicação: [docs/deployment.md](docs/deployment.md).
