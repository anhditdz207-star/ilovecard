import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base './' so it works on GitHub Pages sub-paths
export default defineConfig({ base: "./", plugins: [react(), tailwindcss()] });
