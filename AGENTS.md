# Project UI conventions

- Use the shared `DialogContent` and `AlertDialogContent` for centered editing and confirmation windows; they constrain width and height to the viewport and scroll tall content, so feature code must not override their fixed positioning or vertical translation.
- Keep deliberately side-anchored navigation sheets separate from editing dialogs; side navigation is not a centered modal.
# Comandas & notificações
- Comissão é calculada e congelada no banco (trigger ao concluir: vínculo procedimento×profissional → % do profissional → % da clínica) em `appointments.commission_pct/commission_amount`; o front só lê esses campos para não divergir do histórico.
- Notificações e auditoria de comandas são geradas por triggers no banco (`notifications`, `comanda_audit_log`); o front nunca insere notificações diretamente.
- Movimentos de caixa usam a coluna `movement_type` (não `type`); erros de insert devem ser propagados.
