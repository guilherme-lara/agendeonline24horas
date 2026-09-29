export const formatComanda = (n?: number | null) =>
  n ? `CMD-${String(n).padStart(6, "0")}` : "";

/** Extrai o número de uma busca como "CMD-000123", "cmd123" ou "123". */
export const parseComandaQuery = (q: string): number | null => {
  const m = q.trim().match(/^(?:cmd-?)?0*(\d+)$/i);
  return m ? Number(m[1]) : null;
};
