import { defineConfig } from 'vite'

// Config minimale : on relève juste le seuil d'avertissement de taille de
// chunk (three.js est volumineux, c'est normal). Pas de manualChunks : le
// nouveau moteur de build de Vite 8 (rolldown) ne prend pas le format objet.
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
