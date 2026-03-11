import path from "path";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tailwindcss(),
    vinext(),
    // Only use Cloudflare plugin for production build (Workers deploy).
    // In dev, SSR runs in Node so WeakRef is available; workerd in dev can cause "WeakRef is not defined".
    ...(command === "build"
      ? [
          cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          }),
        ]
      : []),
  ],
  ssr: {
    external: ["phaser"],
  },
}));
