import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // 1. MUDANÇA CRUCIAL: 'prompt' impede que a página atualize sozinha 
      // e quebre o fluxo de pagamento do cliente.
      registerType: "prompt", 
      manifest: {
        name: "AgendeOnline24horas",
        short_name: "AgendeOnline",
        description: "Sistema de agendamento para barbearias",
        theme_color: "#0a0f1a",
        background_color: "#0a0f1a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/logo-agenda-CPNscrQt.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo-agenda-CPNscrQt.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/logo-agenda-CPNscrQt.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"],
        // 3. OTIMIZAÇÃO DE RETORNO: Garante que o app não fique "pendurado"
        // esperando o Service Worker antigo morrer.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true, // Permite testar o PWA no seu localhost:8080
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
}));
