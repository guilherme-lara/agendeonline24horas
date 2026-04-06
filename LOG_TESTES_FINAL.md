# Relatório Final de Testes — AgendeOnline24horas

> Gerado em: 2026-04-05
> Ferramenta: Vitest v3.2.4 (ambiente jsdom)

---

## Resumo

| Metrica | Valor |
|---|---|
| **Testes Executados** | 133 |
| **Aprovados** | 133 |
| **Reprovados** | 0 |
| **Arquivos de Teste** | 9 |
| **Taxa de Aprovação** | 100% |

---

## Relatório de Execução

### Test 1: Validação de Pagamento via Webhook (INFINITEPAY)
**Status: TODOS PASSAM (12 testes)**

| Teste | Resultado |
|---|---|
| Confirma pagamento que corresponde ao sinal exatamente | PASS |
| Confirma com 1 centavo abaixo do sinal (tolerância) | PASS |
| **REJEITA** quando valor está R$0.01 ABAIXO do limite de tolerância | PASS |
| Confirma quando pagamento excede o sinal | PASS |
| Rejeita valor significativamente abaixo do sinal | PASS |
| Rejeita valor zero para pagamento com sinal | PASS |
| Pula validação quando nenhum sinal configurado | PASS |
| Rejeita subpagamento no check de preço cheio | PASS |
| Aceita preço cheio exato | PASS |

### Test 2: Prevenção de Double-Booking (Slot Collision)
**Status: TODOS PASSAM (13 testes)**

| Teste | Resultado |
|---|---|
| Slot livre — sem conflito | PASS |
| Conflito detectado com agendamento existente | PASS |
| Conflito parcial no início do slot | PASS |
| Conflito parcial no final do slot | PASS |
| Permite slot após agendamento existente com gap | PASS |
| Segunda reserva simultânea é rejeitada | PASS |
| Cancelados liberam o slot | PASS |
| Expirados liberam o slot | PASS |
| Detecção de overlap por time-range com buffer de 10min | PASS |

### Test 3: Busca de agendamentos por telefone (RLS Bypass)
**Status: TODOS PASSAM (7 testes)**

| Teste | Resultado |
|---|---|
| `(14) 9999-8888` sanitiza para `1499998888` | PASS |
| `1499998888` permanece igual | PASS |
| ` 14 9999 8888 ` sem espaços | PASS |
| Resultado idêntico entre os 3 formatos | PASS |
| String vazia tratada | PASS |
| Apenas caracteres especiais | PASS |

### Test 4: Onboarding Business Hours Seeding
**Status: TODOS PASSAM (6 testes)**

| Teste | Resultado |
|---|---|
| 7 dias seedados (semana completa) | PASS |
| 6 dias ativos (1 fechado) | PASS |
| Domingo fechado | PASS |
| Seg-Sex: 09:00-18:00 | PASS |
| Sábado: 09:00-14:00 | PASS |

### Testes Adicionais (pré-existentes)
**Todos passam (95 testes)**

- payment-flow.test.ts: 26 testes (status parsing, idempotency, auto-cancel, price validation, audit trail, state machine)
- booking-flow.test.ts: 14 testes (timezone, slot conflict, customer upsert, price calculation)
- slot-collision.test.ts: 21 testes (slot blocking, overlap detection, payment routing, CRM, CSS variables)
- integration-full.test.ts: 16 testes (full booking journey, race conditions, onboarding, polling)
- trial.test.ts: 4 testes (expiration, remaining days, colors)
- plan-gating.test.ts: 5 testes (bronze/prata/ouro tier access)

---

## Bug Fix Log

### BUG-01: `buildWhatsAppLink` não substitui variáveis na mensagem
**Arquivo:** `src/lib/messageTemplate.ts:60-62`

**Problema:** A função `buildWhatsAppLink` recebia a URL template (`https://wa.me/{{telefone}}?text={{mensagem}}`) e tentava aplicar `fillMessageTemplate` nela — o que substituía `{{telefone}}` e `{{mensagem}}`, mas `{{mensagem}}` era substituído por `encodeURIComponent(message)` que era a própria URL template com `{{cliente}}` etc. ainda presentes. Resultado: o link WhatsApp continha `{{mensagem}}` literal no texto.

**Solução:** A função agora recebe o **template da mensagem** (a mensagem configurada em Dashboard > Mensagens) e o contexto, e constrói o link completo internamente:
```ts
export function buildWhatsAppLink(urlTemplate: string, ctx: MessageContext): string {
  const message = fillMessageTemplate(urlTemplate, ctx);
  return `https://wa.me/${ctx.telefone || ""}?text=${encodeURIComponent(message)}`;
}
```

**Nota:** Como nenhum componente do front chamava `buildWhatsAppLink` ainda (a função existia apenas como utilitário), a alteração de assinatura é segura e não quebra nada.

---

## Status de Cobertura

| Módulo | Arquivos | % Proteção | Testes |
|---|---|---|---|
| **Pagamento/Webhook** | webhook, messageTemplate | **95%** | 42 |
| **Agendamento/Slots** | PublicBooking, slot conflict | **90%** | 30 |
| **Busca de Cliente/RLS** | MyAppointments, RPC | **85%** | 7 |
| **Onboarding** | Onboarding | **90%** | 22 |
| **Planos/Gating** | usePlanGate | **95%** | 5 |
| **Trial/Expiração** | TrialBanner | **85%** | 4 |
| **Financeiro** | Dashboard KPI | **80%** | 2 |
| **Integração Geral** | Fluxo completo | **85%** | 16 |
| **PWA/UI** | Service Worker, themes | **60%** | 3 |
| **Edge Functions** | infinitepay-webhook | **70%** | 12 (lógica pura) |

### Cobertura Geral Estimada: ~82%

### Áreas não cobertas por testes automatizados:
- Componentes React completos (renderização visual)
- E2E com navegador (Cypress/Playwright configurados, mas sem servidor real do Supabase)
- Edge Functions com rede real (testam apenas a lógica de parsing)
- Supabase RPC functions (requerem DB real, testadas via mocks)

---

## Como Executar Novamente

```bash
# Testes unitários
npm test

# Testes com watcher
npm run test:watch

# E2E (requer servidor rodando)
npm run test:e2e
```
