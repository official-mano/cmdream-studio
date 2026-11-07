# CMDream Studio

**Command-line art in motion.**

CMDream Studio turns a plain-language animation idea into a small, validated JSON scene plan, then draws every frame with a fixed ASCII renderer. The model never returns executable code, and model output is never evaluated or executed.

The repository contains a public-facing website and animation workspace (`index.html` and `studio.html`) plus an Electron desktop app. The website is a static site; the desktop app adds a tightly scoped local Ollama bridge.

## What it does

- Animate flowers, hearts, rings, fireworks, stars, smoke, waves, and houses with a layered, smooth-looping ASCII renderer, prompt-matched color and a near-black CRT-inspired terminal preview. Offline scene descriptions retain the requested idea and pick a compatible palette from color and mood words.
- Ask a configured AI composer for other subjects: it returns a bounded illustration plan made of safe shapes, which the fixed renderer draws without running model code.
- Choose low, medium, high, extra, or max detail; each level applies consistently across every supported subject.
- Turn on **Fine detail** in the terminal preview to shrink the display glyphs and render a resize-aware grid up to 240×60; turn it off for the larger, standard preview.
- Compose scenes offline without an account, model, or API key.
- Use a local Ollama model from the desktop app.
- Optionally connect OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, or an OpenAI-compatible provider.
- Preview, pause, restart, seek, change playback speed, revisit recent scenes, and export scene JSON or standalone HTML.
- Inspect the validated scene plan before exporting it.
- Explore six live, max-detail renderer examples on the homepage; their grids adapt to the available card size and respect reduced-motion preferences.

## Run locally

Install Node.js 22 or newer, then:

```sh
npm install
npm run dev
```

Open the local address printed by Vite. The landing page is `/`; the workspace is `/studio.html`.

Run the desktop app during development:

```sh
npm run desktop
```

Run the tests and production website build:

```sh
npm test
npm run build
```

## AI choices and privacy

### Offline composer

The built-in composer draws its supported subjects immediately, including hearts, without a network connection or API key. It sends no prompts anywhere. For a subject outside its built-in set, choose an AI composer in Settings; the model can describe a custom illustration as validated lines, shapes, and colors. Online/local models can interpret more requests, but results depend on that model and are not guaranteed for every possible subject.

### Ollama on your computer

1. Install [Ollama](https://ollama.com/download) on the same computer as the desktop app.
2. Download a model, for example `ollama pull llama3.2`.
3. Open CMDream Studio desktop, choose **Settings → Ollama**, select the local model ID, and test the connection.

The desktop app talks to the Ollama HTTP API on `127.0.0.1`/`localhost`; its bridge rejects non-loopback hosts. Model weights are not bundled. You install Ollama and download the model yourself.

**A Render-hosted website cannot connect to Ollama running on a visitor's PC.** Local-model use is available in the desktop app only.

### Cloud providers

Select a provider in **Settings**, enter its model ID / deployment and endpoint where needed, then enter your own API key. CMDream keeps credentials in page memory only: they are not saved to local storage, sent to a CMDream server, or written to application logs. Closing/reloading the page clears them. From the hosted website, prompts and the key are sent directly from your browser to the provider. The desktop app sends them through its local Electron process to the provider to avoid browser CORS restrictions; they are not sent to a CMDream server. The provider handles the request under its own terms. Browser-based provider requests can be subject to provider CORS settings; configure the provider endpoint to allow your site, or use the desktop app.

Do not use a shared/public computer for a cloud key. Remove/revoke any key you no longer want to use.

## Deploy the website on Render

1. Create a GitHub repository named **`cmdream-studio`** and upload this repository's files to its root.
2. In Render, choose **New → Blueprint**, connect the GitHub repository, and approve the `render.yaml` static-site configuration. You can also create a **Static Site** manually with build command `npm ci --include=dev && npm run build` and publish directory `dist`.
3. Render builds the Vite website and shows the service's public URL in its dashboard. It will normally look like `https://cmdream-studio.onrender.com`; Render assigns the exact `onrender.com` hostname, and may add a suffix if that name is already taken. Use the actual URL shown by Render.
4. To connect a custom domain **you control**, open the static site's **Settings → Custom Domains** in Render, add the hostname, then add the DNS records Render displays at your domain registrar/DNS provider. Wait for DNS verification and TLS certificate provisioning. Keep the `onrender.com` address as a working fallback.

Render only hosts the public static site; it does not host an Ollama server or receive AI provider keys.

### Point the download buttons at your GitHub repository

Before deploying, replace `YOUR-GITHUB-USERNAME` in `index.html` and `studio.html` with the GitHub owner or organization name for your repository. The website buttons then lead to that repository's latest GitHub Release and the workspace setup guide points to its README.

## Desktop release builds

GitHub Actions in `.github/workflows/desktop-builds.yml` builds:

- Windows installer `.exe` (NSIS)
- Portable Windows `.exe`
- Linux `.AppImage`

To publish a release, update the `version` in `package.json`, commit and push that change, then tag that commit with the matching version:

```sh
git tag v1.0.1
git push origin v1.0.1
```

Pushing a `v*` tag runs the Windows and Linux builds, creates a GitHub Release, and attaches the three files. A manual run from **Actions → Build desktop downloads → Run workflow** builds downloadable workflow artifacts without publishing a release. The website's latest-release link becomes useful once a release exists.

The generated Windows installers are not code-signed. Windows may show a SmartScreen warning until you sign builds with a certificate you control.

## Scene plans and renderer

Plans are JSON data only. Version 2 scene plans add an allowlisted layer stack, a low/medium/high/extra/max detail value, bounded per-subject form settings, and easing phases for the animation. Custom subjects can be represented by a limited set of normalized-coordinate primitives (lines, rectangles, ellipses, triangles, hearts, and polylines) with allowlisted colors, glyphs, and motions. The validator clamps numeric values and rejects unsupported properties, shapes, and animation parts. Older version 1 history entries are upgraded when loaded. The renderer consumes only the normalized plan; it never interprets JavaScript, HTML, shell commands, or model-generated drawing instructions. Standalone HTML exports embed the same fixed renderer and validated scene data.

The renderer gives each supported subject its own structure rather than filling the canvas with generic symbols. A rose has nested petal layers, shaded folds, a pollen center, a curved stem, veined leaves, and a grounded base. Its stem, leaves, outer petals, middle petals, inner petals, and stamens enter in overlapping phases; the bloom holds, then closes gently before the loop. Fireworks expand and fade radially, rings rotate with facet highlights, and houses include a roof, walls, door, windows, and changing interior light. Background stars use sparse depth layers and restrained twinkle/parallax.

Detail is selectable in the workspace and saved into each scene plan:

| Detail | Example rose plan | Render treatment |
|---|---|---|
| Low | `DETAIL_EXAMPLES.low` in `src/scene.js` | Sparse stars and particles, simple shading, and fewer subject accents. |
| Medium | `DETAIL_EXAMPLES.medium` in `src/scene.js` | More contours, shading, foliage veins, and background depth. |
| High | `DETAIL_EXAMPLES.high` in `src/scene.js` | Full subject detail, layered shading, highlights, and balanced particles. |
| Extra | `DETAIL_EXAMPLES.extra` in `src/scene.js` | Denser textures, finer contours, more subject accents, and additional particles. |
| Max | `DETAIL_EXAMPLES.max` in `src/scene.js` | Maximum bounded detail, depth, shading, highlights, and motion accents. |

These are complete, validated scene plans for the same rose prompt; only their `detail` field differs. The same shared levels are available for every built-in and custom subject. They can be inspected with `DETAIL_EXAMPLES` in the source or composed in the workspace at each setting.

Scene history is stored in the browser's local storage on that device. Provider credentials and settings are not persisted.

## Repository

```text
cmdream-studio/
├── .github/workflows/desktop-builds.yml
├── electron/                 # Desktop shell and local Ollama bridge
├── src/                      # Fixed renderer, scene contract, provider adapters, UI
├── tests/
├── index.html                # Public-facing landing page
├── studio.html               # Animation workspace
├── package.json
├── render.yaml
└── vite.config.js
```

## License

MIT. See [LICENSE](./LICENSE).
