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
`verify_jwt = false`. Isso permite chamadas sem sessão Supabase validada pelo
gateway; não autentica o provedor e não autoriza a operação por si só.

No código atual de `infinitepay-webhook/index.ts`:

- o endpoint aceita POST sem validação de assinatura/HMAC;
- reconhece status e códigos de sucesso informados no corpo;
- confere valores em alguns caminhos, mas permite confirmação quando não há
  valor no payload;
- usa service role para consultar e atualizar registros.

Consequentemente, a confirmação do pagamento por esse endpoint não deve ser
considerada autenticada criptograficamente. A correção requer implementar a
verificação conforme a especificação oficial da InfinitePay, proteger contra
replay e testar casos de assinatura ausente, inválida e payload adulterado.
Não assumir que `INFINITEPAY_WEBHOOK_SECRET` está configurada ou consumida sem
evidência no código/ambiente.

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

1. Confirmar que as migrações foram aplicadas no ambiente e revisar RLS por
   tabela/ação (SELECT, INSERT, UPDATE e DELETE).
2. Verificar que nenhuma credencial server-side chegou ao bundle ou aos logs.
3. Testar agendamento concorrente, expiração e idempotência de pagamentos.
4. Testar o webhook com assinatura inválida e válida depois que a verificação
   criptográfica estiver implementada.
5. Conferir que Realtime e invalidação de cache não expõem dados de outro
   tenant.
6. Executar os testes relevantes e build antes do deploy.
