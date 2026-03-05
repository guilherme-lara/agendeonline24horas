import { QueryClient } from "@tanstack/react-query";

// Singleton QueryClient - Criado FORA de qualquer componente React
// Blindagem contra Silent Crash: foco na retenção de estado
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // networkMode: 'always' - REMOVIDO: pode causar problemas quando aba perde foco
      networkMode: 'online', // Só executa quando online
      refetchOnWindowFocus: false, // DESABILITADO: evita flickering quando volta foco
      staleTime: 1000 * 60 * 5, // 5 minutos - mantém dados frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - mantém em cache
      retry: 1,
      // Blindagem contra re-renderizações acidentais
      refetchOnMount: false, // Não refaz query ao montar componente
      refetchOnReconnect: true, // Só quando volta conexão
    },
    mutations: {
      networkMode: 'online',
      retry: 1,
    }
  }
});