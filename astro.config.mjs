// @ts-check
import { defineConfig, envField } from "astro/config";

import netlify from "@astrojs/netlify";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en", "ca"],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  env: {
    schema: {
      STRIPE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
    },
  },

  adapter: netlify(),
  integrations: [react()],
});