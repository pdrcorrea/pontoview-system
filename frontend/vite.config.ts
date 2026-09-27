import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const buildId =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  new Date().toISOString();

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
