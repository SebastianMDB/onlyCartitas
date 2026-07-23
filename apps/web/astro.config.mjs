import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

const productionSiteUrl = "https://www.onlycartitas.cl";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? productionSiteUrl : "http://localhost:4321"),
  vite: {
    resolve: {
      preserveSymlinks: true
    },
    plugins: [tailwindcss()]
  }
});
