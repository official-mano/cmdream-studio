import { defineConfig } from "vite";
import packageMetadata from "./package.json" with { type: "json" };

export default defineConfig({
  base: "./",
  plugins: [{
    name: "cmdream-app-version",
    transformIndexHtml(html) {
      return html.replaceAll("__CMDREAM_APP_VERSION__", packageMetadata.version);
    }
  }],
  server: {
    watch: {
      ignored: ["**/release/**"]
    }
  },
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        studio: "studio.html",
        downloads: "downloads.html",
        guide: "guide.html",
        about: "about.html"
      }
    }
  }
});
