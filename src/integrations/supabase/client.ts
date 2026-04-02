// Supabase Client - Seguro e Flexível
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Faltam variáveis de ambiente do Supabase. Verifique seu arquivo .env",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) =>
      fn(),
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
