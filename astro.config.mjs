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
      STRIPE_WEBHOOK_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      TELEGRAM_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      TELEGRAM_CHAT_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
      PUBLIC_CALENDLY_COUPLES_EVENT_TYPE_ID: envField.string({
        context: "client",
        access: "public",
      }),
      PUBLIC_CALENDLY_FAMILY_EVENT_TYPE_ID: envField.string({
        context: "client",
        access: "public",
      }),
      PUBLIC_CALENDLY_FRIENDS_EVENT_TYPE_ID: envField.string({
        context: "client",
        access: "public",
      }),
      PUBLIC_CALENDLY_INDIVIDUAL_EVENT_TYPE_ID: envField.string({
        context: "client",
        access: "public",
      }),
      PUBLIC_STRIPE_PUBLISHABLE_KEY: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },

  adapter: netlify(),
  integrations: [react()],
});
