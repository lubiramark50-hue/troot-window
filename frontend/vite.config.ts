import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Pages builds must identify the commit actually deployed, rather than
  // copying the Android/main branch version manifest into every preview.
  define: process.env.CF_PAGES_COMMIT_SHA ? {
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(process.env.CF_PAGES_COMMIT_SHA),
  } : {},
  plugins: [react(), {
    name: "cloudflare-build-version",
    generateBundle() {
      const commit = process.env.CF_PAGES_COMMIT_SHA;
      if (!commit) return;
      if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error("Invalid Cloudflare build commit");
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({
        version: commit, commit, updatedAt: new Date().toISOString(),
      }, null, 2) + "\n" });
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
