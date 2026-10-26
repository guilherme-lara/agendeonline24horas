# Segurança e operação

## Identidade e autorização

- A autenticação de usuários é feita pelo Supabase Auth.
- A aplicação consulta os papéis `admin` e `barber` em `user_roles`.
- `useClinic` resolve a barbearia do proprietário ou a barbearia associada ao
  profissional. A impersonação é um recurso do fluxo administrativo.
- A chave usada no navegador é a chave pública Supabase. Ela não substitui RLS.
- A service role deve permanecer somente em secrets do backend/Edge Functions.
- Rotas de frontend e `PlanGate` organizam a experiência, mas não são controles
  de autorização suficientes para proteger dados.

## Isolamento multi-tenant

Os dados de negócio são associados a uma barbearia, normalmente por
`barbershop_id`. As políticas RLS e as funções SQL são responsáveis por
restringir leitura e escrita ao tenant e papel autorizados.

As políticas mudam ao longo das migrações. Há políticas públicas específicas
para viabilizar o agendamento sem login (por exemplo, leitura de serviços
associados e operações de clientes). Antes de alterar acesso público, revise
todos os comandos `CREATE POLICY` e as políticas anteriores da tabela: uma
política permissiva pode ampliar o acesso efetivo.

## Integrações e pagamentos

`create-pix-charge` e `infinitepay-webhook` estão configurados com
`verify_jwt = false`, pois o provedor não envia um JWT Supabase. A primeira
função exige um JWT de usuário e valida se a pessoa é administradora,
proprietária ou profissional ativo da barbearia; também valida a relação entre
agendamento e tenant e limita a cobrança ao saldo do agendamento.

O webhook exige o segredo server-side `INFINITEPAY_WEBHOOK_SECRET`, enviado pelo
provedor no cabeçalho `x-infinitepay-webhook-secret`. Sem segredo configurado,
ou com cabeçalho ausente/incorreto, o endpoint falha de forma fechada e não
confirma pagamentos. Configure o segredo no ambiente de Edge Functions e o
mesmo valor no cabeçalho personalizado do webhook da InfinitePay. Não use uma
query string para transportar esse segredo. A disponibilidade de cabeçalhos
personalizados no painel do provedor deve ser confirmada antes de ativar a
confirmação automática; não foi presumida uma assinatura/HMAC da InfinitePay.

O webhook também exige valor e referência única válidos, valida o saldo e o
valor esperado da cobrança, evita registrar payload completo nos logs e usa uma
função SQL restrita a `service_role` para registrar o pagamento de forma
idempotente. A política de inserção direta em `appointment_payments` limita
profissionais às comandas atribuídas a eles. Se a integração do provedor não
puder enviar o cabeçalho secreto, a confirmação automática permanece desativada
até que haja um mecanismo de autenticação suportado e verificado.

O fluxo também grava informações recebidas em `payment_logs`; trate esses dados
como operacionais e potencialmente sensíveis e evite registrar documentos ou
credenciais em logs.

## Variáveis e configuração

### Frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`

Variáveis com prefixo `VITE_` são distribuídas ao navegador. Nunca colocar
service role, token InfinitePay ou segredos de webhook nesse grupo.

### Supabase Edge Functions

As funções usam configuração/segredos server-side do Supabase, incluindo
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Credenciais InfinitePay por
barbearia são consultadas em `barbershop_secrets`. Manter os valores secretos no
ambiente protegido e limitar seu acesso.

## PWA e disponibilidade

`vite-plugin-pwa` cria manifest e service worker para instalação e cache de
assets. A aplicação usa atualização em modo prompt. O rewrite em `vercel.json`
direciona URLs da SPA para `index.html`, permitindo carregar rotas do React
diretamente.

O cache de assets do service worker não equivale a suporte offline completo:
consultas e operações de negócio dependem do Supabase e de conectividade. O
Realtime do painel invalida consultas quando recebe eventos; não há garantia
de sincronização em tempo real quando o cliente está desconectado.

## Verificações antes de publicar mudanças

1. Aplicar as migrações pendentes, incluindo as funções públicas limitadas para
   disponibilidade/status/expiração e revisar RLS por tabela/ação.
2. Verificar que nenhuma credencial server-side chegou ao bundle ou aos logs.
3. Configurar `INFINITEPAY_WEBHOOK_SECRET` em Edge Function Secrets e confirmar
   que a InfinitePay consegue enviar o cabeçalho personalizado.
4. Testar agendamento concorrente, expiração, autenticação/tenant da cobrança e
   idempotência de pagamentos.
5. Testar o webhook sem segredo, com segredo incorreto, sem valor e com valor
   válido antes de habilitar pagamentos reais.
6. Conferir que Realtime e invalidação de cache não expõem dados de outro
   tenant.
7. Executar os testes relevantes e build antes do deploy.
