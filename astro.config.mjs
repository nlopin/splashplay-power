// @ts-check
import { defineConfig, envField } from "astro/config";

import netlify from "@astrojs/netlify";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { shouldIncludeInSitemap } from "./src/utils/seo-paths.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://splashplay.es",

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
      CALENDLY_WEBHOOK_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_COUPLES_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_FAMILY_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_FRIENDS_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_INDIVIDUAL_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_THROW_PAINT_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      CALENDLY_CUSTOMIZE_CLOTHES_EVENT_TYPE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      NETLIFY_SITE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
      NETLIFY_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
      PUBLIC_STRIPE_PUBLISHABLE_KEY: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },
  redirects: {
    // paths from the old website https://github.com/nlopin/splashplay-web
    "/cat": "/ca",
    "/cat.html": "/ca",
    "/friends/en": "/en/friends",
    "/friends/en.html": "/en/friends.html",
    "/friends/cat": "/ca/friends",
    "/friends/cat.html": "/ca/friends.html",
    "/couples/en": "/en/couples",
    "/couples/en.html": "/en/couples.html",
    "/couples/cat": "/ca/couples",
    "/couples/cat.html": "/ca/couples.html",
    "/family/en": "/en/family",
    "/family/en.html": "/en/family.html",
    "/family/cat": "/ca/family",
    "/family/cat.html": "/ca/family.html",
  },
  adapter: netlify(),
  integrations: [
    react(),
    sitemap({
      filter: shouldIncludeInSitemap,
    }),
  ],
});
