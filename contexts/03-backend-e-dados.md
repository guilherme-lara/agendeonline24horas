# Backend e dados

## Supabase

O backend é fornecido principalmente pelo Supabase:

- **Auth**: sessões e identidade.
- **PostgreSQL**: fonte persistente dos dados da aplicação.
- **RLS**: autorização por linha para operações feitas com o cliente público.
- **Funções SQL/RPC**: operações que precisam ser executadas no banco como uma
  unidade, por exemplo criação pública de agendamento e checkout do PDV.
- **Realtime**: propagação de mudanças ao painel.
- **Edge Functions**: endpoints Deno para integrações e operações server-side.

As migrações ativas estão em `supabase/migrations/`. `migrations_backup/` é
histórico auxiliar e não deve ser interpretado como o conjunto atual de schema.
Os tipos em `src/integrations/supabase/types.ts` ajudam o TypeScript, mas as
migrações implantadas definem o schema real de cada ambiente.

## Domínios de dados

Os nomes abaixo são agrupados por responsabilidade a partir do schema tipado e
das migrações. As relações e colunas completas devem ser conferidas no schema
implantado.

| Domínio | Tabelas representativas | Responsabilidade |
| --- | --- | --- |
| Tenant e identidade | `barbershops`, `profiles`, `user_roles`, `barbers`, `saas_plans` | Barbearia, proprietário, profissionais, papéis e plano. |
| Agendamento | `appointments`, `appointment_items`, `customers`, `clients`, `services`, `categories`, `barber_services`, `business_hours`, `professional_schedules`, `professional_time_offs` | Reserva, itens de serviço, cliente, catálogo, vínculo profissional e disponibilidade. |
| Financeiro e caixa | `appointment_payments`, `cash_registers`, `cash_movements`, `expenses`, `payment_logs` | Pagamentos, caixa, movimentações, despesas e auditoria de integração de pagamento. |
| PDV e estoque | `sales`, `sales_items`, `orders`, `inventory`, `packages` | Vendas de balcão, itens, produtos e pacotes. |
| Operação e auditoria | `notifications`, `activity_logs`, `comanda_audit_log`, `barbershop_comanda_counters` | Notificações, histórico de ações e numeração/auditoria de comandas. |
| Segredos de integração | `barbershop_secrets` | Credenciais privadas de integração associadas à barbearia; não devem ser expostas ao navegador. |

## Funções SQL e invariantes

As migrações incluem funções e triggers para encapsular operações ou manter
dados derivados. Exemplos encontrados:

- `create_public_appointment`: criação de agendamento iniciado pelo fluxo
  público;
- `checkout_pdv`: processamento de venda/checkout do PDV;
- funções de atualização de pagamento e de comissão;
- triggers para recalcular totais, registrar auditoria e atribuir número de
  comanda;
- funções de limpeza de agendamentos de pagamento expirados.

Há também migrações de RLS para dados operacionais, schedules, vendas e outros
domínios. Algumas migrações criam políticas públicas de leitura ou escrita para
que a reserva sem login funcione; as condições concretas devem ser revisadas
junto com a respectiva migração e com o ambiente aplicado.

## Edge Functions

| Função | Responsabilidade observada |
| --- | --- |
| `create-pix-charge` | Busca barbearia/agendamento e credenciais de pagamento com service role; seleciona fluxo PIX estático ou integra com a API InfinitePay. |
| `infinitepay-webhook` | Recebe notificações de pagamento, registra log, valida o estado/valor recebido frente ao agendamento e tenta atualizar o pagamento. |
| `create-barber-account` | Fluxo server-side relacionado à criação de conta de profissional. |
| `revoke-barber-account` | Revogação de conta de profissional. |
| `reset-user-password` | Operação de redefinição de senha. |

`supabase/config.toml` desabilita a verificação JWT do gateway para
`create-pix-charge` e `infinitepay-webhook`. Portanto, cada endpoint precisa
validar explicitamente a entrada e a autorização apropriadas. O webhook também
precisa validar autenticidade da origem de acordo com o contrato da InfinitePay;
veja [Segurança e operação](./05-seguranca-e-operacao.md).

## Realtime

`useLiveAppointments` abre um canal por `barbershop_id` e escuta mudanças nas
tabelas `appointments` e `customers`. Os eventos invalidam chaves de React
Query, atualizando as telas que consomem esses dados. O frontend limita a taxa
de eventos configurada no cliente Supabase.
