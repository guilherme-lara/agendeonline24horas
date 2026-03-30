
📝 Contexto do Sistema: Agende Online 24 Horas
Este documento serve como a Fonte da Verdade para a arquitetura e as regras de negócio deste SaaS. Leia-o atentamente antes de realizar qualquer alteração no código.

🏗️ 1. Arquitetura Técnica
Frontend: React + TypeScript + Vite + Tailwind CSS.

Backend: Supabase (Auth, Database, Edge Functions, Realtime, Storage).

Gerenciamento de Estado: TanStack Query (React Query) para sincronização e cache.

Pagamentos: Integração com InfinitePay para geração de Pix dinâmico.

⚖️ 2. Regras de Ouro (Business Rules)
Qualquer alteração deve respeitar estes pilares:

🚫 A Regra "No Pay, No Slot" (Trava de Agenda)
Contexto: Para agendamentos via Pix Online (pix_online), o horário não deve ser bloqueado enquanto o status for pending ou awaiting.

Lógica: O slot só é oficialmente alocado e visível para o barbeiro após a confirmação do Webhook da InfinitePay (status: confirmed).

Exceção: Pagamentos realizados "No Local" (dinheiro/cartão físico no balcão) têm reserva imediata.

💰 Fluxo Financeiro e Comissões
Separação de Papéis: O Barbeiro apenas marca o serviço como completed (Concluído). No entanto, o registro financeiro (order) e a baixa no faturamento bruto do dono ocorrem exclusivamente via Caixa.tsx (POS).

Cálculo: O Barbeiro vê o valor líquido (Sua % de comissão). O Dono vê o valor bruto (Faturamento total da loja).

Integridade: Toda order deve carregar obrigatoriamente o barber_id e o amount original do agendamento para evitar relatórios órfãos ou zerados.

🚀 Fluxo de Onboarding (Anti-Ghost)
Persistência Precoce: A barbearia deve ser criada no banco de dados (insert) logo no Passo 1 (Nome e Slug).

Estado Incompleto: Passos 2, 3 e 4 devem apenas atualizar (update) esse registro. Isso permite que o SuperAdmin veja barbearias que abandonaram o processo no meio.

Redirecionamento: Se um usuário logado não possui barbearia (barbershop === null), ele deve ser forçado para /onboarding.

📊 3. Estrutura de Dados (Database Schema)
barbershops: Tabela mestre (inquilino/tenant).

barbers: Profissionais vinculados a uma barbearia. Possuem commission_pct.

appointments: Agendamentos. Campos críticos: status, payment_status, barber_id.

orders: Vendas/Comandas finalizadas no caixa.

inventory: Controle de estoque de produtos vendidos no caixa.

📱 4. UX e Mobile First
Realtime: O Dashboard do Barbeiro deve usar Supabase Realtime para atualizar a agenda instantaneamente sem F5.

Drag and Drop: Deve funcionar via TouchSensor no mobile com delay de 250ms para não quebrar o scroll da página.

Feedback: O sistema utiliza useSoundFeedback (sons de "Ca-ching") e vibração háptica em ações de sucesso.

🧪 5. Estratégia de Testes e Qualidade
O sistema utiliza Vitest para testes unitários e de integração. Todo novo recurso ou correção de bug crítico deve vir acompanhado de testes que cubram:

Cenários Críticos de Teste:
Gating de Planos (App.tsx):

Validar que usuários no plano Bronze conseguem acessar a rota /dashboard/caixa.

Validar que recursos "Ouro" permanecem bloqueados para planos inferiores.

Lógica de Trial (Onboarding.tsx):

Validar que novas barbearias recebem o plano pro com data de expiração de +30 dias.

Cálculos Financeiros:

Testar a função de cálculo de comissão para garantir que arredondamentos de centavos não gerem perdas.

Redirecionamento de Role:

Garantir que um usuário com role barber nunca seja redirecionado para o /onboarding.