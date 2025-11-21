import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // IMPORTANT for Electron production builds
  base: "./",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },

  server: {
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false
      }
    }
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
