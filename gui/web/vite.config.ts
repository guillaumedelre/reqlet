import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Forward /api/* to reqlet-agent.
    // In Docker Compose the agent is reached via its service name; on the host via localhost.
    proxy: {
      "/api": process.env.API_TARGET ?? "http://localhost:3001",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: ["node_modules/", "src/test/", "dist/"],
      include: [
        "src/store/**",
        "src/hooks/**",
        "src/lib/**",
        "src/types.ts",
        "src/components/layout/app-layout.tsx",
        "src/components/layout/environment-pane.tsx",
        "src/components/layout/header-bar.tsx",
        "src/components/layout/side-panel.tsx",
        "src/components/layout/settings-dialog.tsx",
        "src/components/layout/tab-bar.tsx",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
})
