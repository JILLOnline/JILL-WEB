import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";
import {reactRouter} from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Shopify's React Router SDK currently uses the Node runtime adapter.
// Worker compatibility is separately validated by CI and the eventual runtime.
export default defineConfig({
  plugins:[cloudflare({
    configPath:process.env.JILL_BUILD_TARGET==="canary"
      ? "./wrangler.canary.jsonc" : "./wrangler.jsonc",
    viteEnvironment:{name:"ssr"},
  }),reactRouter(),tsconfigPaths()],
});
