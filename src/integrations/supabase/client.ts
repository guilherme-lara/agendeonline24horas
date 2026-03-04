// 1. Core do Supabase
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://whtlqimtclodchfdljcg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodGxxaW10Y2xvZGNoZmRsamNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3NDMsImV4cCI6MjA4NjQwODc0M30.wQeww1HOx2rQlmF_RA7rB8BnS8_7hfjVanArHkBY0CQ";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Impede que o getSession() trave em contextos de iframe
    lock: (name: string, acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
  // --- CONFIGURAÇÃO BLINDADA PARA MOBILE (TECH BAURU) ---
  realtime: {
    params: {
      eventsPerSecond: 10, // Aumenta a cadência de processamento de eventos
    },
    config: {
      // Mágica da Reconexão: Tenta restabelecer o túnel WebSocket 
      // de forma exponencial até o limite de 30 segundos.
      reconnectAfterMs: (parseInt) => Math.min(parseInt * 2, 30000),
    }
  }
});
