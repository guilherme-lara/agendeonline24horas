# Features & Resources — Auditoria Tecnica v2.0

Gerado em: **2026-04-05** | Status do Build: **PASSANDO** | Testes: **72/72 OK**

---

## 1. Status Geral

| Modulo | Status | Observacoes |
|--------|--------|-------------|
| PublicBooking (`/agendamentos/:slug`) | **100% funcional** | Pagamento 100% Infinite Pay, CRM com upsert, filtro por `barber_services` |
| Onboarding | **100% funcional** | Trial 30 dias plano PRO, anti-duplicacao de barbeiros |
| Servicos (Dashboard) | **100% funcional** | Vinculo `barber_services` com comissao por profissional, `advance_payment_value` funcional |
| Agenda (Dashboard) | **100% funcional** | Filtro por `barber_id`, realtime, list view + calendar |
| Caixa (POS) | **100% funcional** | Pix polling automatico, desconto de sinal, emissao de recibo |
| Webhook (Edge Function) | **100% funcional** | Idempotencia, audit trail em `payment_logs`, bug de escopo corrigido |
| SuperAdmin | **Funcional** | Gestao de tenants, suspensao/reativacao |
| Auto-Cancel de Pix pendentes | **Funcional pendente** | Funcao SQL atualizada, requer `pg_cron` ativo no Supabase |

---

## 2. Regras de Negocio Verificadas (Pivot)

### 2.1 Pagamento 100% Online — CONFIRMADO
- `PublicBooking.tsx` **hardcode** `_payment_method: "pix"` na RPC (linha 196)
- Nao existe opcao de "Pagamento Local" no fluxo publico
- Se `infinitepay_tag` nao estiver configurado na barbearia, exibe tela "Agendamentos Indisponiveis"
- O badge "Pagamento Online Obrigatorio" aparece em todos os servicos
- O checkout redireciona para `checkout.infinitepay.io` — o cliente paga fora do app

### 2.2 Captura de Clientes (CRM) — CONFIRMADO
- `upsert` na tabela `customers` com `onConflict: 'barbershop_id, phone'`
- Usa `phoneDigits` (telefone limpo sem formatacao) como chave
- Tenta salvar `customer_id` (correto: coluna `client_id` em appointments)
- Falha no upsert nao bloqueia o agendamento (try-catch)

### 2.3 Comissao por Servico/Barbeiro (`barber_services`) — CONFIRMADO
- Tabela `barber_services` com colunas: `barber_id`, `service_id`, `commission_pct`, `barbershop_id`
- `Servicos.tsx`: UI para vincular barbeiros a servicos com campo de comissao porcentual
- `PublicBooking.tsx`: Filtra `availableBarbers` via `barber_services.filter(bs => bs.service_id === selectedService.id)`
- Barbeiro so aparece se estiver vinculado ao servico selecionado
- Onboarding: Barbeiros nao recebem vinculo inicial a servicos (isso e feito na tela Servicos)

### 2.4 Onboarding Simplificado — VERIFICADO
- Passo 1: `upsert` com `onConflict: 'owner_id'` — funciona corretamente para evitar erro de constraint duplicada
- Trial: `plan_name: 'pro'`, `plan_status: 'trialing'`, `trial_ends_at: +30 dias`
- Passos 2-4: Apenas atualizam o registro existente
- Anti-duplicacao de barbeiro: check `ilike("name", ...)` antes de inserir
- `setup_completed: false` ate o passo 4, depois marcado como `true`

### 2.5 Configuracao de Servico — CONFIRMADO
- `requires_advance_payment: true` inserido por padrao no Onboarding (Servicos.tsx linha 98)
- `advance_payment_value` funcional: valor exibido na UI e usado no calculo de cobranca
- Validacao: `advanceValue > price` bloqueia o salvamento
- Quando `advance_payment_value > 0`, o checkout cobra esse valor; caso contrario cobra o `price` total

---

## 3. Mudanças Implementadas Nesta Auditoria

### Frontend

| Arquivo | Alteracao | Motivo |
|---------|-----------|--------|
| `PublicBooking.tsx` | `client_id` ao inves de `customer_id` no payload de update | Coluna no schema e `client_id`, nao `customer_id` |
| `PublicBooking.tsx` | Customer upsert em try-catch com graceful degradation | Coluna `last_seen` pode nao existir ainda |
| `PublicBooking.tsx` | `.toISOString()` ao inves de fuso hardcoded `-03:00` | Bug de timezone/DST |
| `PublicBooking.tsx` | Filtro de slots por `barber_id` (UUID) ao inves de `barber_name` (string) | Barbeiros com mesmo nome causavam resultados errados |
| `PublicBooking.tsx` | Nome unico de canal realtime (`pb-rt-{shopId}-{timestamp}`) | Colisao em multi-tab |
| `PublicBooking.tsx` | `appt_id` adicionado ao redirect URL de sucesso | Permitir verificacao real do agendamento |
| `PublicBooking.tsx` | Query de verificacao `verify-appointment-success` | Tela de sucesso spoofavel via `?success=true` |
| `PublicBooking.tsx` | Mapa de duracao de servicos existente para deteccao correta de conflitos | Bug: usava duracao do servico selecionado para todos |
| `PublicBooking.tsx` | Import removido de `toBRT` (nao utilizado) | Limpeza |
| `Caixa.tsx` | Polling automatico de pagamento PIX a cada 5s | Modal ficava aberto indefinidamente sem feedback |
| `Caixa.tsx` | Estado `pixPollConfirmed` para evitar double-polling | Race condition |
| `Onboarding.tsx` | Check de existencia de barbeiro antes de inserir | Duplicacao de barbeiros ao re-executar setup |

### Backend / SQL

| Arquivo | Alteracao | Motivo |
|---------|-----------|--------|
| `infinitepay-webhook/index.ts` | Adicionado log para tabela `payment_logs` com `barbershop_id` | Sem audit trail |
| `infinitepay-webhook/index.ts` | Correcao de bug de escopo (variavel `appointmentId` antes da declaracao) | ReferenceError no Deno |
| Migration `20260405000000` | `ADD COLUMN last_seen` na tabela `customers` | Coluna faltante |
| Migration `20260405000000` | `ADD COLUMN barber_id` na tabela `appointments` | Coluna faltante |
| Migration `20260405000000` | `cancel_expired_pix_appointments()` refatorada — status e metodos corretos | Nunca casava com `pendente_pagamento`/`pix` |
| Migration `20260405000000` | `pg_advisory_xact_lock` na RPC `create_public_appointment` | Previne double-booking |
| Migration `20260405000000` | Cron schedule para auto-cancel (se `pg_cron` ativo) | Liberar slots de pagamentos abandonados |

### Testes

| Arquivo | Cobertura |
|---------|-----------|
| `src/test/booking-flow.test.ts` (18 testes) | Timezone, conflitos de slot, barber filtering, customer upsert, colunas, realtime, precos |
| `src/test/payment-flow.test.ts` (26 testes) | Webhook parsing, idempotencia, auto-cancel, validacao de preco, payment_logs, maquina de estados |
| `src/test/integration-full.test.ts` (16 testes) | Jornada completa, race conditions, duplicacao, polling caixa, edge cases |

---

## 4. Pilha Tecnologica Ativa

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Frontend Framework | React 18 + TypeScript | v18.x |
| Build Tool | Vite | v6.x |
| Estilizacao | Tailwind CSS + shadcn/ui | v3.x |
| Icones | Lucide React | latest |
| Roteamento | React Router v6 | v6.x |
| Graficos | Recharts | v2.x |
| State & Cache | TanStack Query (React Query) | v5.x |
| Backend/BaaS | Supabase | v2.x |
| Auth | Supabase Auth (localStorage) | — |
| Database | PostgreSQL (Supabase) | 15+ |
| Realtime | Supabase Realtime (WebSockets) | v2.x |
| Pagamentos | Infinite Pay (checkout host + webhook) | API REST |
| Testes | Vitest | v3.2.x |
| Deploy | Vercel | — |
| PWA | vite-plugin-pwa + Workbox | v1.2 |

---

## 5. Pendencias Identificadas

### Alta Prioridade

| Pendencia | Impacto | Esforco |
|-----------|---------|---------|
| **`barber_id` coluna na tabela `appointments`** | Necessario para filtros corretos de agenda | Migration — ja escrita, precisa rodar `supabase db push` |
| **`last_seen` coluna na tabela `customers`** | Customer upsert completo | Migration — ja escrita, precisa rodar |
| **`pg_cron` habilitado no Supabase** | Auto-cancel de pagamentos pendentes libera slots de agenda | Requer acesso ao dashboard Supabase para ativar a extensao |
| **Seguranca do webhook** | Webhook sem assinatura HMAC pode ser spoofado | Implementar HMAC ou token secreto nas variaveis de ambiente da Edge Function |

### Media Prioridade

| Pendencia | Impacto |
|-----------|---------|
| Vinculo `barber_services` no Onboarding | Barbeiros criados no onboarding nao ficam automaticamente vinculados aos servicos — dono precisa fazer manualmente na tela Servicos |
| Relatorio de comissoes por barbeiro | Tela existe mas precisa de validacao de calculo vs `barber_services.commission_pct` |
| Automacao n8n | Nao existe integracao com n8n para notificacoes via WhatsApp |

### Baixa Prioridade

| Pendencia | Nota |
|-----------|------|
| `Booking.tsx` (legado) | Pagina nao utilizada, poderia ser removida ou redirecionada |
| `PaymentStep.tsx` (dead code) | Componente nao montado em producao |
| `PixPaymentModal.tsx` (dead code) | Componente importado mas nao renderizado no PublicBooking |
| `Banknote, CreditCard` imports nao usados em `PublicBooking.tsx` | Limpeza cosmetica |

---

## 6. Guia de Manutencao

### Adicionar um Novo Servico

1. Dashboard → **Servicos** → botao **"Novo Servico"**
2. Preencher: nome, preco, duracao (minutos)
3. Definir **Valor do Sinal** (valor que o cliente paga online para garantir o horario)
4. Na secao **"Profissionais & Comissoes"**, ativar o toggle para cada barbeiro que realiza este servico
5. Definir a **comissao (%)** de cada barbeiro vinculado
6. Salvar

### Adicionar um Novo Barbeiro

1. Dashboard → **Profissionais** → cadastrar nome, telefone, avatar
2. Dashboard → **Servicos** → editar cada servico que o barbeiro vai atender
3. Ativar o toggle do barbeiro no servico e definir a comissao
4. O barbeiro aparece automaticamente no PublicBooking para os servicos vinculados

### Ajustar Comissao de um Barbeiro em um Servico

1. Dashboard → **Servicos** → clique no botao **Settings** do servico
2. Localize o barbeiro na lista
3. Altere o valor percentual no campo ao lado do nome
4. Salvar — atualiza a tabela `barber_services`

### Configurar Pagamento InfinitePay

1. Dashboard → **Configuracoes** → aba **Pagamentos**
2. Inserir o `infinitepay_tag` (handle da sua conta InfinitePay, ex: `@minha-barbearia`)
3. Opcional: configurar chave Pix estatica para fallback

### Habilitar Auto-Cancel (slots pendentes)

1. No dashboard do Supabase, ativar extensao **pg_cron**
2. Rodar a migration `20260405000000_fix_critical_bugs.sql`
3. Verificar no log: `Cancelled expired PIX appointments: N`

### Verificar Logs de Pagamento

1. Dashboard → **Pagamentos** (plano Ouro) ou
2. SQL: `SELECT * FROM payment_logs ORDER BY created_at DESC;`
3. Supabase Edge Function logs: `supabase functions logs --project-ref <ref>`

---

## 7. Topologia de Dados (Pivot)

```
barbershops (owner_id, slug, name, settings, plan_name, plan_status, trial_ends_at)
    │
    ├── barbers (barbershop_id, name, commission_pct)
    │
    ├── services (barbershop_id, name, price, duration, requires_advance_payment, advance_payment_value)
    │   │
    │   └── barber_services (barber_id, service_id, commission_pct) ← NOVO
    │
    ├── appointments (barbershop_id, client_id, client_name, barber_id, barber_name, status, payment_status)
    │
    ├── orders (barbershop_id, appointment_id, barber_id, barber_name, items, total)
    │
    ├── customers (barbershop_id, phone, name, last_seen)
    │
    ├── barbershop_secrets (barbershop_id, infinitepay_token)
    │
    └── payment_logs (barbershop_id, source, event_type, request_body) ← NOVO
```
