import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// The web player must remain stable for 24/7 signage. A normal deploy should
// not force an already-running browser session to navigate/reload, because
// browsers can leave fullscreen after a page navigation. Administrative
// changes are synchronized by the player state/manifest flow instead.
const buildId = "stable-web-player";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "pontoview-build-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "build-version.json",
          source: JSON.stringify({ version: buildId }),
        });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(buildId) },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
