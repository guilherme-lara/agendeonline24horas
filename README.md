# QuickBarber

O QuickBarber é uma plataforma de gestão e agendamento feita para barbearias.
Reúne agenda online, cadastro de serviços e profissionais, comandas, PDV,
clientes, caixa e acompanhamento da operação.

## Recursos

- Agendamento público por link da barbearia.
- Gestão de horários, serviços, profissionais e clientes.
- Comandas, vendas no PDV, caixa e movimentações.
- Pagamentos via PIX/InfinitePay nos fluxos configurados.
- Painel web instalável como PWA.
- Acesso multi-tenant com Supabase Auth e políticas RLS.

## Arquitetura

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS e
  shadcn/ui.
- **Estado remoto:** TanStack React Query.
- **Backend:** Supabase Auth, PostgreSQL, RLS, Realtime, funções SQL e Edge
  Functions em Deno.
- **Pagamentos:** integração com InfinitePay.
- **PWA:** `vite-plugin-pwa` e service worker.

Os documentos arquiteturais estão em [`contexts/`](./contexts/README.md).

## Desenvolvimento local

Requisitos: Node.js e npm.

```bash
npm install
npm run dev
```

Configure as variáveis públicas do Supabase no ambiente local:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`

## Comandos

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

As Edge Functions e o banco Supabase também dependem da configuração de
ambiente e secrets correspondente. Consulte `supabase/config.toml` e
`supabase/migrations/`.
