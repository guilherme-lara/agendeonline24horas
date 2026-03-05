// Supabase Client - sem tipagem estrita para compatibilidade com SDK v2.95+
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://whtlqimtclodchfdljcg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodGxxaW10Y2xvZGNoZmRsamNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3NDMsImV4cCI6MjA4NjQwODc0M30.wQeww1HOx2rQlmF_RA7rB8BnS8_7hfjVanArHkBY0CQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
