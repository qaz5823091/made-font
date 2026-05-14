import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
 
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: "/", 
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
}))
