import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@renderer": path.resolve(__dirname, "src/renderer"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/renderer/__tests__/setup.ts"],
    css: false,
  },
});
