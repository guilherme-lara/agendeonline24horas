/**
 * Dynamic message template replacement utility.
 *
 * Variables:
 *  {{cliente}}   -> Client name
 *  {{servico}}   -> Service name
 *  {{data}}       -> Formatted date (DD/MM/YYYY)
 *  {{horario}}    -> Appointment time (HH:MM)
 *  {{barbeiro}}   -> Barber name
 *  {{preco}}      -> Formatted price (R$ X,XX)
 *  {{valor_falta}}-> Remaining balance to pay at the shop (R$ X,XX)
 */

export const DEFAULT_CONFIRMATION_TEMPLATE =
  `Olá {{cliente}}, seu agendamento para {{servico}} no dia {{data}} às {{horario}} está confirmado!`;
export const DEFAULT_WHATSAPP_LINK =
  `https://wa.me/{{telefone}}?text={{mensagem}}`;

export const AVAILABLE_VARIABLES = [
  { key: "{{cliente}}", label: "Nome do cliente" },
  { key: "{{servico}}", label: "Serviço agendado" },
  { key: "{{data}}", label: "Data (DD/MM/YYYY)" },
  { key: "{{horario}}", label: "Horário (HH:MM)" },
  { key: "{{barbeiro}}", label: "Nome do barbeiro" },
  { key: "{{preco}}", label: "Valor total (R$)" },
  { key: "{{valor_falta}}", label: "Saldo restante no local (R$)" },
  { key: "{{telefone}}", label: "Telefone com DDD (apenas dígitos)" },
  { key: "{{mensagem}}", label: "A própria mensagem renderizada (para URL encode do link)" },
] as const;

interface MessageContext {
  cliente: string;
  servico: string;
  data: string;
  horario: string;
  barbeiro?: string;
  preco?: number;
  valor_falta?: number;
  telefone?: string;
}

export function fillMessageTemplate(
  template: string,
  ctx: MessageContext,
): string {
  const formatCurrency = (val?: number) =>
    val != null ? `R$ ${val.toFixed(2).replace(".", ",")}` : "";

  return template
    .replace(/{{cliente}}/g, ctx.cliente)
    .replace(/{{servico}}/g, ctx.servico)
    .replace(/{{data}}/g, ctx.data)
    .replace(/{{horario}}/g, ctx.horario)
    .replace(/{{barbeiro}}/g, ctx.barbeiro || "Geral")
    .replace(/{{preco}}/g, formatCurrency(ctx.preco))
    .replace(/{{valor_falta}}/g, formatCurrency(ctx.valor_falta))
    .replace(/{{telefone}}/g, ctx.telefone || "");
}

export function buildWhatsAppLink(template: string, ctx: MessageContext): string {
  const message = fillMessageTemplate(template, ctx);
  return template
    .replace(/{{telefone}}/g, ctx.telefone || "")
    .replace(/{{mensagem}}/g, encodeURIComponent(message));
}
