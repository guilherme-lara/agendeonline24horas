

# Plano de Implementacao - AgendeOnline24horas (6 Modulos)

Este plano cobre todas as 6 areas solicitadas: Layout/Sidebar, Motor Financeiro, Trava de Vendas, Retencao/Fidelidade, PWA e Sistema de Sinal.

---

## MODULO 1: Layout e Roteamento (Sidebar Exclusiva)

### 1.1 Ocultar Header nas rotas /dashboard
- **Arquivo**: `src/components/Header.tsx` (linha 20)
- Expandir a condicao de retorno `null` para incluir `/dashboard`
- Condicao atual: `if (pathname.startsWith("/book/") || pathname.startsWith("/agendamentos/"))` 
- Nova: adicionar `|| pathname.startsWith("/dashboard")`

### 1.2 Ocultar Footer nas rotas /dashboard
- **Arquivo**: `src/App.tsx`
- Envolver `<Footer />` em logica condicional que verifica se a rota atual comeca com `/dashboard`

### 1.3 Mover ThemeToggle para o Sidebar
- **Arquivo**: `src/components/DashboardSidebar.tsx`
- Importar `ThemeToggle` e adiciona-lo na secao de footer do sidebar (linha ~114), acima do botao de Logout
- **Arquivo**: `src/components/Header.tsx`
- Remover `<ThemeToggle />` do header (manter apenas no sidebar quando no dashboard)

### 1.4 Estilizacao Premium nos cards
- Aplicar classes `bg-card border border-border/50 shadow-sm rounded-xl backdrop-blur-sm` nos cards do Dashboard e modais principais

---

## MODULO 2: Motor Financeiro e CSV

### 2.1 Dashboard com 4 Cards de Resumo (com filtro de data)
- **Arquivo**: `src/components/FinancialTab.tsx` (ja possui filtros Hoje/Semana/Mes/Personalizado)
- Expandir para incluir dados de `expenses` e `orders`:
  - **Receita Bruta**: `SUM(appointments.price)` (status completed) + `SUM(orders.total)` (status closed)
  - **Comissoes**: Iterar appointments concluidos x `barber.commission_pct`
  - **Despesas**: `SUM(expenses.amount)` no periodo
  - **Lucro Liquido**: Receita - (Comissoes + Despesas)
- Adicionar fetch de `expenses` e `orders` no `fetchData()`

### 2.2 Funcao Exportar CSV
- Criar novo componente ou funcao utilitaria `exportToCSV(data, filename)`
- Usa `Blob` + `URL.createObjectURL` + `<a download>`
- Adicionar botao "Exportar (.csv)" no FinancialTab (secao de relatorios)
- Exporta os dados da tabela de comissoes filtrada pelo periodo ativo

---

## MODULO 3: Trava de Vendas (Upgrade Flow)

### 3.1 Toast de Boas-Vindas
- **Arquivo**: `src/pages/Dashboard.tsx`
- Adicionar `useEffect` que verifica `localStorage` para flag `techbarber_welcome_shown`
- Se nao existir, dispara toast com nome do plano e salva flag

### 3.2 Modal de Lead para Upgrade
- **Arquivo**: `src/components/UpgradeModal.tsx`
- Refatorar: remover logica de mudanca direta de plano
- Adicionar campo WhatsApp com mascara `(XX) XXXXX-XXXX`
- Botao "Solicitar" fica `disabled` ate numero completo (14 chars formatado)
- Ao enviar: `INSERT INTO upgrade_requests (barbershop_id, requested_plan, whatsapp, status)` com `status: 'pendente'`

### 3.3 Tela de Aprovacao no Super Admin
- **Arquivo**: `src/pages/SuperAdmin.tsx`
- Adicionar secao/tab "Solicitacoes de Upgrade"
- `SELECT * FROM upgrade_requests WHERE status = 'pendente'`
- Botoes de Aprovar (atualiza plano no `saas_plans`) e Rejeitar

### 3.4 Migracao SQL
- Nenhuma necessaria - tabela `upgrade_requests` ja existe
- RLS: ja tem policy para INSERT (`auth.uid() = barbershop_id`) - porem essa policy esta incorreta (compara uuid do user com uuid do barbershop). Precisa corrigir para usar subquery: `barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())`
- Adicionar policies de SELECT/UPDATE para admins

---

## MODULO 4: Retencao (Fidelidade e Lembretes)

### 4.1 Lembrete WhatsApp 1-Clique
- **Arquivo**: `src/pages/Dashboard.tsx`
- Na tabela de agendamentos (acoes dropdown), adicionar item "Lembrete WhatsApp"
- Gera URL: `https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(mensagem)}`
- Mensagem: "Ola [nome]! Passando para confirmar seu agendamento hoje as [hora] com [barbeiro]. Confirma?"

### 4.2 Cartao Fidelidade
- **Arquivo**: `src/pages/MyAppointments.tsx`
- Apos buscar agendamentos, contar quantos tem `status = 'completed'`
- Exibir barra de progresso visual: "X de 10 cortes" com `Progress` da shadcn
- Ao atingir 10, exibir badge "Parabens! Voce ganhou um brinde!"

### 4.3 Badge no Admin
- **Arquivo**: `src/pages/Dashboard.tsx`
- Na listagem de agendamentos, ao renderizar cliente, buscar contagem de concluidos
- Se >= 9, exibir Badge "Falta 1 para brinde!"

---

## MODULO 5: PWA

### 5.1 Configuracao vite-plugin-pwa
- **Arquivo**: `vite.config.ts`
- Instalar `vite-plugin-pwa` e configurar:
  - `registerType: 'autoUpdate'`
  - Manifest com `name`, `short_name`, `theme_color`, `background_color`, icones baseados em `/logo-agenda.png`
- **Arquivo**: `public/manifest.webmanifest` (criado pelo plugin)

### 5.2 Service Worker
- O `vite-plugin-pwa` registra automaticamente
- Configurar `workbox` para cache de assets estaticos

---

## MODULO 6: Sistema de Sinal/Adiantamento

### 6.1 Migracao SQL
- `ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_advance_payment BOOLEAN DEFAULT false`
- `ALTER TABLE services ADD COLUMN IF NOT EXISTS advance_payment_value NUMERIC(10,2) DEFAULT 0`
- Nota: a constraint de status em appointments nao sera adicionada via CHECK (o campo status ja e text sem constraint); usaremos o valor 'pendente_sinal' diretamente

### 6.2 Admin - Toggle nos Servicos
- **Arquivo**: `src/pages/Dashboard.tsx` (tab settings) ou criar componente `ServicesTab.tsx`
- Adicionar Switch "Exige Sinal?" por servico
- Se ativado, exibir Input numerico para `advance_payment_value`
- Salvar via `UPDATE services SET requires_advance_payment, advance_payment_value`

### 6.3 Fluxo do Cliente (PublicBooking)
- **Arquivo**: `src/pages/PublicBooking.tsx`
- Apos selecionar servico com `requires_advance_payment = true`:
  - Exibir Alert: "Este servico requer adiantamento de R$ [valor]"
- No submit: se servico exige sinal, status = `pendente_sinal`
- Gerar link WhatsApp: "Ola, acabei de solicitar [servico]. Segue comprovante do PIX de R$ [valor] referente ao sinal."

### 6.4 Buscar dados de advance_payment nos servicos
- Atualizar query de servicos em PublicBooking para incluir `requires_advance_payment, advance_payment_value`

---

## Secao Tecnica: Resumo de Arquivos Modificados

```text
CRIADOS:
- supabase/migrations/[timestamp]_advance_payment_and_fixes.sql
  (colunas advance_payment em services, fix RLS upgrade_requests)

MODIFICADOS:
- src/components/Header.tsx (ocultar em /dashboard, remover ThemeToggle)
- src/components/DashboardSidebar.tsx (adicionar ThemeToggle)
- src/components/FinancialTab.tsx (4 KPIs com expenses/orders, exportar CSV)
- src/components/UpgradeModal.tsx (modal de lead com WhatsApp)
- src/pages/Dashboard.tsx (welcome toast, lembrete WhatsApp, badge fidelidade)
- src/pages/SuperAdmin.tsx (secao solicitacoes de upgrade)
- src/pages/MyAppointments.tsx (cartao fidelidade visual)
- src/pages/PublicBooking.tsx (alerta de sinal, status pendente_sinal)
- src/App.tsx (ocultar Footer no dashboard)
- vite.config.ts (vite-plugin-pwa)
- src/integrations/supabase/types.ts (auto-gerado)
```

---

## Migracao SQL Completa

```sql
-- Modulo 6: Colunas de sinal nos servicos
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS requires_advance_payment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS advance_payment_value NUMERIC(10, 2) DEFAULT 0;

-- Modulo 3: Fix RLS upgrade_requests (policies atuais comparam auth.uid() com barbershop_id incorretamente)
DROP POLICY IF EXISTS "Donos podem criar solicitações" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Donos podem ver suas próprias solicitações" ON public.upgrade_requests;

CREATE POLICY "Owners can insert upgrade requests" ON public.upgrade_requests
  FOR INSERT WITH CHECK (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can view own upgrade requests" ON public.upgrade_requests
  FOR SELECT USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can view all upgrade requests" ON public.upgrade_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update upgrade requests" ON public.upgrade_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
```

---

## Validacoes QA (Pre-entrega)

| # | Teste | Criterio |
|---|-------|----------|
| 01 | Calculo de Lucro | Receita - (Comissoes + Despesas) nao retorna NaN (protecao com `\|\| 0` em todos os reduces) |
| 02 | RLS upgrade_requests | Policy usa subquery em barbershops, nao comparacao direta user_id = barbershop_id |
| 03 | WhatsApp URL (lembrete) | `phone.replace(/\D/g, '')` remove espacos, hifen e parenteses antes de montar |
| 04 | WhatsApp URL (sinal) | Mesmo sanitizacao + `encodeURIComponent` no texto |
| 05 | CSV Export | Blob type `text/csv;charset=utf-8;` com BOM para Excel |
| 06 | PWA Manifest | Icons apontam para assets existentes |
| 07 | Header oculto no /dashboard | Retorna null quando pathname.startsWith("/dashboard") |

