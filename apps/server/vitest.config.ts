import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { env: { CG_FAST: "1" }, testTimeout: 20000, hookTimeout: 20000, pool: "threads", poolOptions: { threads: { singleThread: true } } },
});
