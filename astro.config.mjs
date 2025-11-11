// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en", "ca"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
