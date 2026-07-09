import { defineConfig } from 'vite'

// On sépare les grosses librairies dans leurs propres fichiers ("chunks").
// Avantage : le navigateur les garde en cache entre deux visites, et seuls
// tes propres fichiers (petits) sont retéléchargés quand tu mets le site à
// jour — le gros three.js n'est rechargé que s'il change vraiment.
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          animation: ['gsap', 'lenis'],
        },
      },
    },
  },
})
