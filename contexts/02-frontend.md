# Frontend

## Inicialização e composição

`src/main.tsx` monta `App`. Em `src/App.tsx`, a árvore global combina:

1. `ErrorBoundary`;
2. `ThemeProvider`;
3. `QueryClientProvider` com o singleton de `src/lib/queryClient.ts`;
4. providers de tooltip e notificações;
5. `BrowserRouter`;
6. `AuthProvider`, `CartProvider` e `BookingProvider`.

O provider de autenticação vem antes das páginas que consultam usuário e perfil.
`useClinic` combina esse estado com consultas React Query para resolver a
a barbearia corrente. O provider de tema altera a classe do elemento raiz e mantém
a preferência no armazenamento local.

## Roteamento e áreas funcionais

As rotas ficam centralizadas em `src/App.tsx`. Os grupos principais são:

| Área | Rotas representativas | Conteúdo |
| --- | --- | --- |
| Aquisição e conta | `/`, `/auth`, `/login`, `/reset-password`, `/subscribe/:planId` | Landing page, autenticação e assinatura. |
| Onboarding | `/onboarding` | Configuração inicial da barbearia. |
| Agendamento público | `/book/:slug`, `/agendamentos/:slug` | Página pública da barbearia, com variante para profissional. |
| Cliente | `/meus-agendamentos`, `/appointments`, `/booking` | Consulta e etapas de agendamento. |
| Operação | `/pdv`, `/pdv/historico`, `/dashboard/*` | PDV, agenda, clientes, serviços, equipe, configurações, relatórios e outros módulos. |
| Administração | `/admin`, `/super-admin` | Administração da aplicação e visão global. |

As telas menos usadas do dashboard são carregadas com `React.lazy` e
`Suspense`. `DashboardLayout` fornece a navegação e o layout operacional,
resolve o usuário e a barbearia, chama `useLiveAppointments` e apresenta estados
de carregamento ou bloqueio por expiração. Algumas áreas usam `PlanGate` para
limitar funcionalidades por plano.

As rotas são registradas no cliente. A proteção de dados não deve depender
somente de esconder uma tela ou redirecionar uma rota: as consultas e gravações
precisam continuar protegidas no banco por RLS ou por funções server-side.

## Estado

| Mecanismo | Uso observado |
| --- | --- |
| React Context | `BookingContext` mantém etapas, profissional, data, horário, cliente e serviços selecionados; `CartContext` mantém serviços/produtos do carrinho; `ThemeContext` mantém o tema. |
| `AuthProvider` em `src/hooks/useAuth.tsx` | Mantém sessão, usuário e flags de papel `admin` e `barber` consultadas em `user_roles`. |
| Hooks de domínio | `useClinic` carrega a barbearia e o vínculo do profissional; `usePlanGate` deriva o nível do plano e permissões de recursos. |
| TanStack React Query | Cache de dados remotos, carregamento, invalidação e sincronização de consultas. O padrão global define cache de cinco minutos e refetch em reconexão. |
| Supabase Realtime | `useLiveAppointments` invalida queries do painel quando há alterações em agendamentos e clientes da barbearia; novos agendamentos geram toast e tentativa de áudio. |
| Armazenamento local | O carrinho e o tema persistem no navegador. Não são fonte de autoridade para preço, acesso ou estado de pagamento. |

## Integração com Supabase

O cliente singleton está em `src/integrations/supabase/client.ts`; exige
`VITE_SUPABASE_URL` e uma chave pública (`VITE_SUPABASE_ANON_KEY` ou
`VITE_SUPABASE_PUBLISHABLE_KEY`). O schema TypeScript gerado fica em
`src/integrations/supabase/types.ts`.

As páginas e hooks chamam as APIs do Supabase diretamente para consultas comuns.
O cache correspondente deve ser invalidado após mutações, e a autorização
precisa ser garantida no banco. `src/lib/queryClient.ts` centraliza os padrões
de cache e repetição.

## Interface instalável

`vite.config.ts` configura `vite-plugin-pwa`, com manifest, service worker,
cache de assets e atualização em modo prompt. A permissão de notificações
solicitada por `useLiveAppointments` não equivale, por si só, a uma integração
com Web Push: o hook atual usa toast e áudio para eventos de inserção.
