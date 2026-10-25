# Arquitetura do QuickBarber

Esta pasta reúne a documentação da arquitetura do sistema. Ela descreve o
comportamento encontrado no código e nas migrações do repositório; não substitui
essas implementações.

> `contexts/` na raiz contém documentação. Os providers de estado React ficam em
> `src/contexts/`.

## Documentos

- [Visão geral](./01-visao-geral.md): componentes, tecnologias e limites do sistema.
- [Frontend](./02-frontend.md): composição da aplicação, páginas, estado e consultas.
- [Backend e dados](./03-backend-e-dados.md): Supabase, modelo de dados e funções.
- [Fluxos principais](./04-fluxos-principais.md): agendamento, operação da barbearia e pagamentos.
- [Segurança e operação](./05-seguranca-e-operacao.md): identidade, isolamento, configuração e observações operacionais.

## Como manter

Atualize os documentos relacionados quando mudar rotas, responsabilidades entre
frontend e backend, fluxos de pagamento, tabelas ou controles de acesso. Em caso
de divergência, o código-fonte e as migrações aplicadas são a referência.
