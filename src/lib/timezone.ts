import { addHours, parseISO } from "date-fns";

/** Fuso horário padrão do sistema (Brasília) */
export const TIMEZONE = "America/Sao_Paulo";
export const BRT_OFFSET = -3;

/**
 * Converte uma data UTC do banco (string ISO) para o horário de Brasília (UTC-3).
 * Essencial para garantir que vendas e agendamentos sejam contabilizados no dia correto.
 */
export const toBRT = (dateStr: string): Date => addHours(parseISO(dateStr), BRT_OFFSET);

/**
 * Retorna a data/hora atual em Brasília como Date object.
 */
export const nowBRT = (): Date => addHours(new Date(), BRT_OFFSET);
