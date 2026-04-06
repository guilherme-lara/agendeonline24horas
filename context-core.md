# MISSION: CRITICAL STABILITY & SERVICE CATEGORIZATION

Atue como Engenheiro Sênior. O objetivo é estabilizar 100% o agendamento público e organizar a vitrine de serviços. Ignore outras funcionalidades por enquanto.

## 1. ESTABILIZAÇÃO TOTAL (Fim dos Erros Vermelhos)
O sistema está com divergência entre o código e o banco.
- **Ação de Banco:** Padronize a tabela `appointments`. Se o código está buscando `customer_id`, garanta que essa coluna exista e esteja vinculada à tabela de clientes. 
- **Ação de RLS:** Certifique-se de que a tabela de clientes (seja `clients` ou `customers`) tenha as políticas de segurança (SELECT, INSERT, UPDATE) liberadas para acesso público (`true`), para que o erro de "Row Level Security" não bloqueie o agendamento.
- **Ação de Fluxo:** No `PublicBooking.tsx`, garanta que o sistema:
  1. Identifique/Crie o cliente.
  2. Reserve o horário como `pending_payment` com `expires_at` (3 minutos).
  3. Redirecione para o pagamento.

## 2. CATEGORIZAÇÃO DE SERVIÇOS (Nova UI)
O cliente deve ter uma navegação organizada e profissional.
- **Banco de Dados:** Adicione uma coluna `category` (TEXT) ou uma tabela `service_categories` vinculada aos `services`.
- **Refatoração do PublicBooking:** Altere a ordem de seleção para:
  1. **Escolha do Profissional:** O cliente escolhe quem vai atendê-lo primeiro.
  2. **Escolha do Serviço por Categoria:** Ao selecionar o profissional, mostre os serviços dele agrupados por categorias (ex: "Cabelo", "Barba", "Combo").
- **UI "A partir de":** Implemente no cadastro de serviços o campo booleano `price_is_starting_at`. Se verdadeiro, mostre "A partir de R$ XX,XX" na vitrine.

## 3. TRAVA DE DISPONIBILIDADE (Pessimistic Locking)
- Garanta que o filtro de horários disponíveis considere como **OCUPADO** qualquer slot que tenha um agendamento `confirmed` OU um `pending_payment` que ainda não expirou. Isso impede que dois clientes vejam o mesmo horário simultaneamente.

Execute essas mudanças e me confirme quando o fluxo estiver "blindado" e a nova organização de serviços estiver ativa.2