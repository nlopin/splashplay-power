import * as esbuild from "esbuild";
import * as path from "path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

// Environment variables that need to be transformed from astro:env/server
// to Netlify.env.get() calls
const ASTRO_ENV_VARS = [
  "CALENDLY_TOKEN",
  "CALENDLY_COUPLES_EVENT_TYPE_ID",
  "CALENDLY_FAMILY_EVENT_TYPE_ID",
  "CALENDLY_FRIENDS_EVENT_TYPE_ID",
  "CALENDLY_INDIVIDUAL_EVENT_TYPE_ID",
  "CALENDLY_THROW_PAINT_EVENT_TYPE_ID",
  "CALENDLY_CUSTOMIZE_CLOTHES_EVENT_TYPE_ID",
  "NETLIFY_SITE_ID",
  "NETLIFY_TOKEN",
  "TELEGRAM_SECRET_KEY",
  "TELEGRAM_CHAT_ID",
];

/**
 * esbuild plugin that transforms `astro:env/server` imports
 * into Netlify.env.get() calls for use in Netlify functions
 */
const astroEnvToNetlifyPlugin: esbuild.Plugin = {
  name: "astro-env-to-netlify",
  setup(build) {
    // Intercept imports from astro:env/server
    build.onResolve({ filter: /^astro:env\/server$/ }, (args) => ({
      path: args.path,
      namespace: "astro-env-shim",
    }));

    // Generate a shim module that exports Netlify.env.get() calls
    build.onLoad({ filter: /.*/, namespace: "astro-env-shim" }, () => {
      const exports = ASTRO_ENV_VARS.map(
        (name) => `export const ${name} = Netlify.env.get("${name}") ?? "";`,
      ).join("\n");

      return {
        contents: exports,
        loader: "ts",
      };
    });
  },
};

async function build() {
  const entryPoints = [
    path.resolve(
      ROOT_DIR,
      "src/netlify-functions/scheduled-availability-refresh.ts",
    ),
    path.resolve(
      ROOT_DIR,
      "src/netlify-functions/refresh-availability-background.ts",
    ),
  ];

  try {
    await esbuild.build({
      entryPoints,
      bundle: true,
      platform: "node",
      target: "es2022",
      format: "esm",
      outdir: path.resolve(ROOT_DIR, "netlify/functions"),
      outExtension: { ".js": ".mjs" },
      plugins: [astroEnvToNetlifyPlugin],
      external: ["@netlify/functions", "@netlify/blobs"],
      tsconfig: path.resolve(ROOT_DIR, "tsconfig.json"),
      logLevel: "info",
    });

    console.log("✓ Netlify functions built successfully");
  } catch (error) {
    console.error("Failed to build Netlify functions:", error);
    process.exit(1);
  }
}

build();
