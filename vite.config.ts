import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/doc2md/",
  test: {
    environment: "jsdom",
    exclude: [".claude/**", ".quest/**", ".worktrees/**", ".ws/**", "node_modules/**", "dist/**"]
  }
});
