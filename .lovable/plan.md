# Plano de Ação — Comandas, Comissões, Agendamento Rápido e Notificações

## 1. Valor da comanda no painel (clínica x profissional)
**Problema:** ao finalizar a comanda, o valor não aparece no painel.

**Regra combinada:**
- Painel do gestor: mostra o valor bruto, a comissão do profissional e o **líquido da clínica** (valor − % do profissional).
- Painel do profissional: mostra **apenas a parte dele** (valor × % dele).
- A comissão só vale como "liberada" depois do OK do gestor. Antes disso, ela aparece como "a liberar".

**Ações:**
- Ao finalizar, marcar o agendamento como concluído/pago e registrar o pagamento no caixa aberto.
- Calcular a comissão usando o % do vínculo procedimento × profissional. Se não houver vínculo, usar o % padrão do profissional e, na falta dele, o % padrão da clínica.
- Guardar o % e o valor da comissão na própria comanda no momento do fechamento. Assim, se o % mudar depois, o histórico não muda.
- Atualizar os números do painel do gestor e do profissional na hora, sem precisar recarregar.

## 2. Profissional no Agendamento Rápido
- Adicionar o campo **Profissional responsável**, obrigatório, com a lista dos profissionais ativos.
- Filtrar a lista pelos profissionais que fazem o procedimento escolhido. Se ninguém tiver vínculo, mostrar todos.
- Enviar o profissional escolhido para a checagem de horário, que passa a apontar conflito na agenda dele.

## 3. ID único das comandas
- Criar um número sequencial legível **por clínica**, no formato `CMD-000123`, gerado automaticamente e impossível de editar.
- Mostrar o número no caixa, no histórico, na tela de aprovações, no comprovante pelo WhatsApp e no extrato em PDF do profissional.
- Permitir buscar pelo número no histórico do caixa.
- Criar um **registro de auditoria** (quem, quando e o que mudou) para abertura, itens adicionados, pagamento, aprovação e cancelamento. Serve para conferência e para questões fiscais.

## 4. Sistema de notificações
- Criar uma central de notificações com um sino no topo, contador de não lidas e lista com a opção "marcar como lida".
- **Gestor recebe:** "Comanda CMD-000123 de [Profissional] aguardando aprovação" e novos agendamentos, com o nome do profissional.
- **Profissional recebe:** "Sua comissão da comanda CMD-000123 foi liberada (R$ X)" e novos agendamentos na agenda dele.
- As notificações aparecem na hora, com som e aviso na tela enquanto o painel estiver aberto. Clicar leva direto para a aprovação ou para a comanda.
- Limitação: avisos com o app fechado precisam de um serviço externo de push. Isso fica para uma etapa futura, opcional.

## Ordem de execução
1. Mudanças no banco: ID da comanda, colunas de comissão, auditoria e notificações.
2. Corrigir o fechamento e os valores do painel (item 1).
3. Profissional no Agendamento Rápido (item 2).
4. Mostrar o ID na interface e permitir a busca (item 3).
5. Central de notificações (item 4).
6. Validar o fluxo de ponta a ponta: agendar, finalizar, aprovar, notificar e conferir os painéis.

## Detalhes técnicos
- `appointments`: novas colunas `comanda_number` (bigint, sequência por `barbershop_id` via trigger), `commission_pct` e `commission_amount`, gravadas ao fechar.
- Nova tabela `comanda_audit_log` com `appointment_id`, `barbershop_id`, `actor_id`, `action` e `payload` jsonb, alimentada por triggers.
- Nova tabela `notifications` com `user_id`, `barbershop_id`, `type`, `title`, `body`, `link`, `read_at` e RLS `user_id = auth.uid()`. Triggers criam as notificações ao concluir o atendimento (para o dono) e na RPC `approve_appointment_commission` (para o profissional). Tabela incluída no realtime.
- Revisar o `SplitPaymentModal` e o fluxo de finalizar no `ProfessionalDashboard`: status, `cash_movements` e invalidar as queryKeys do painel e do PDV.
- `QuickBooking`: passar `_barber_id` e `_barber_name` para `create_public_appointment`.
- Todas as tabelas novas com GRANT e RLS multi-tenant por `barbershop_id`.
