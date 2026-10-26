import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" keeps the build portable: data, PDFs and figures are fetched relative to index.html
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
