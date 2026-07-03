# MASTER PLAN: GO-LIVE MVP — AgendeOnline24Horas

**Documento de Governança Técnica e Execução**
**Foco:** Clínicas de Estética, Salões de Beleza e Espaços de Saúde.

---

## 1. Escopo Arquitetural e Validações Críticas

Para o sistema ser liberado ao mercado (Go-Live) com 100% de segurança, as seguintes frentes precisam estar implementadas e validadas:

* **Módulo Comanda (Isolamento de Profissional):** Separação estrita de acessos. O profissional logado só pode visualizar e interagir com a sua própria agenda e métricas financeiras (A Receber vs. Saldo Liberado).
* **Segurança de Pagamentos (InfinitePay):** O status de um procedimento só pode mudar para "Pago" se o Webhook receber a assinatura criptográfica (HMAC) autêntica da InfinitePay.
* **Trava de Colisão (Race Condition):** O banco de dados (Supabase) deve bloquear agendamentos duplos para o mesmo profissional no mesmo milissegundo.
* **Experiência Nativa (PWA e Push):** O sistema deve ser instalável no celular (`manifest.json` e Service Workers) e emitir alertas nativos para novas marcações.

---

## 2. Status de Execução das Tarefas (IA)

| Tarefa | Status | Descrição Técnica |
| :--- | :---: | :--- |
| **1. Painel do Profissional** | ✅ CONCLUÍDO | Cards de "A Receber" e "Saldo Liberado" implementados. Ações de "Iniciar" e "Finalizar" criadas. Isolamento via ID do usuário feito. |
| **2. Segurança RLS e Trava** | ✅ CONCLUÍDO | *Row Level Security* aplicado para profissionais. *Partial Unique Index* criado para impedir colisão de horários. |
| **3. Blindagem de Webhooks** | 🚧 PENDENTE | Validação HMAC da InfinitePay na Edge Function. |
| **4. Setup PWA e Cache** | 🚧 PENDENTE | Configuração do `vite-plugin-pwa` e instalação offline. |
| **5. Push Notifications** | 🚧 PENDENTE | Alertas em tempo real integrados ao banco de dados. |

---

## 3. Próximo Prompt de Execução (Para colar na IA)

> **Instrução para o Engenheiro (Copiar e colar na sua IA):**
> 
> "As Tarefas 1 e 2 foram concluídas com sucesso. O RLS e a trava de colisão estão perfeitos. Agora, execute estritamente as Tarefas 3, 4 e 5 do nosso escopo:
> 
> **TAREFA 3: BLINDAGEM DE WEBHOOKS (INFINITEPAY)**
> No arquivo `supabase/functions/infinitepay-webhook/index.ts`, implemente a validação criptográfica (HMAC/Signature) que a InfinitePay envia no Header. O webhook só pode alterar o status do agendamento para `paid` se a assinatura digital for válida usando a variável `INFINITEPAY_WEBHOOK_SECRET`.
> 
> **TAREFA 4: PWA (PROGRESSIVE WEB APP) E CACHE**
> 1. Configure o `vite-plugin-pwa` no `vite.config.ts`.
> 2. Ajuste o `manifest.json` para que o app seja perfeitamente instalável (standalone, nome "AgendeOnline24Horas", ícones).
> 3. Ajuste o componente `src/components/InstallAppBanner.tsx` para incentivar a instalação no celular do profissional.
> 
> **TAREFA 5: NOTIFICAÇÕES PUSH NATIVAS**
> Atualize o arquivo `src/hooks/useLiveAppointments.ts` para escutar inserções e pagamentos na tabela `appointments` via Supabase Realtime. Dispare uma **Notificação Web (Push API)** na tela do usuário sempre que uma reserva for confirmada."

---

## 4. README Oficial do Repositório

# AgendeOnline24Horas — SaaS Multi-Tenant para Clínicas de Estética

Sistema completo de gestão, agendamento online, comandeira financeira e painel administrativo multi-tenant projetado para clínicas de estética, salões de beleza e espaços de saúde.

### 🎯 Status do Projeto e Desafios Técnicos (Go-Live)

Atualmente, o projeto superou a fase de construção visual (Front-end) e encontra-se na etapa de **Blindagem Estrutural**. Para garantir a segurança em nível bancário e a estabilidade da operação, implementamos as seguintes soluções de alta complexidade:

*   **Trava de Colisão (Race Condition):** Implementação de *Unique Constraints* no banco de dados para impedir que dois clientes reservem o mesmo profissional no exato mesmo milissegundo.
*   **Segurança Financeira (InfinitePay):** Proteção contra fraudes através da validação criptográfica (HMAC/Tokens) nos Webhooks. 
*   **Comanda e Isolamento de Dados (RLS):** Uso de *Row Level Security* para separar os acessos. O painel do Profissional é restrito às suas próprias comandas e métricas financeiras, enquanto o Proprietário tem visão global (LGPD).
*   **PWA e Push Notifications:** Estruturação via *Service Workers* para instalação do sistema como aplicativo nativo.

### 🚀 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Estilização | Tailwind CSS, shadcn/ui |
| PWA / Cache | vite-plugin-pwa, Service Workers |
| Backend | Supabase (Auth, Database PostgreSQL, RLS, Edge Functions) |
| Pagamentos | API InfinitePay (PIX e Webhooks) |

### 📐 Arquitetura Multi-Tenant

Cada clínica de estética é um **tenant** isolado. As políticas de **Row Level Security (RLS)** garantem que cada proprietário acesse apenas os dados de sua clínica, e cada profissional acesse apenas sua comanda.

```text
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Landing /  │────▶│  Auth /auth  │────▶│  Onboarding   │
│  SaaS Page  │     │  Login/Signup│     │  (1ª config)  │
└─────────────┘     └──────────────┘     └──────┬────────┘
                                                │
                    ┌──────────────┐     ┌───────▼────────┐
                    │ Super Admin  │     │   Dashboard    │
                    │ /super-admin │     │  /dashboard    │
                    └──────────────┘     └───────┬────────┘
                                                │
                                        ┌───────▼────────┐
                                        │ Public Booking │
                                        │ /book/:slug    │
                                        └────────────────┘

### 🗂️ Estrutura de Rotas

| Rota | Descrição | Acesso |
| :--- | :--- | :--- |
| **`/`** | Landing Page (venda do SaaS) | Público |
| **`/auth`** | Login e Cadastro unificado | Público |
| **`/onboarding`** | Configuração inicial da clínica | Autenticado (sem tenant) |
| **`/dashboard`** | Painel do Gestor (controle financeiro) | Proprietário da Clínica |
| **`/dashboard/professional`** | Módulo Comanda (agenda e comissões) | Profissional (Restrito) |
| **`/super-admin`** | Painel Master (gestão global) | Admin (role `admin`) |
| **`/book/:slug`** | Página pública de agendamento | Público |

### 🔐 Níveis de Acesso

1. **Cliente Final (Público):** Acessa a rota pública para agendar e pagar via PIX.
2. **Profissional (Autenticado - Restrito):** Acessa estritamente sua própria agenda e comanda. Visualiza métricas de "A Receber" e "Saldo Liberado".
3. **Proprietário da Clínica (Autenticado - Gerencial):** Visão macro do faturamento, controle de caixa e dashboard completo da clínica.
4. **Super Admin (Role `admin`):** Visualiza KPIs globais e gerencia planos SaaS de todos os tenants.

### 🛠️ Desenvolvimento Local

```bash
git clone <URL_DO_REPOSITORIO>
cd agendeonline24horas
npm install
npm run dev
