# CMDream Studio

**Command-line art in motion.**

CMDream Studio turns a plain-language animation idea into a small, validated JSON scene plan, then draws every frame with a fixed ASCII renderer. The model never returns executable code, and model output is never evaluated or executed.

The repository contains a public-facing website, project overview (`about.html`), animation workspace (`studio.html`), download center (`downloads.html`), user guide (`guide.html`), and an Electron desktop app. The website is static; the download center reads the bundled `product-info.json` catalog and links directly to the configured public file host. It does not call GitHub for product or release data. The desktop app adds a tightly scoped local Ollama bridge.

## What it does

- Animate flowers, hearts, rings, fireworks, stars, smoke, waves, and houses with a layered, smooth-looping ASCII renderer, prompt-matched color and a near-black CRT-inspired terminal preview. Offline scene descriptions retain the requested idea and pick a compatible palette from color and mood words.
- Ask a configured AI composer for other subjects: it returns a bounded illustration plan made of safe shapes, which the fixed renderer draws without running model code.
- Choose low, medium, high, extra, or max detail; each level applies consistently across every supported subject.
- Turn on **Fine detail** in the terminal preview to shrink the display glyphs and render a resize-aware grid up to 240×60; turn it off for the larger, standard preview.
- Compose scenes offline without an account, model, or API key.
- Use a local Ollama model from the desktop app.
- Optionally connect OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, or an OpenAI-compatible provider.
- Preview, pause, restart, seek, change playback speed, and revisit recent scenes.
- Export a monochrome PNG, an MP4/WebM loop where the browser supports recording, or a ZIP scene pack with JSON, standalone HTML, and a text preview. The share action opens the device share menu when the browser supports it.
- Use the Windows/macOS/Linux desktop app's native menus to move between the home page, workspace, About, downloads, and documentation.
- Inspect the validated scene plan before exporting it.
- Explore six live, max-detail renderer examples on the homepage; their grids adapt to the available card size and respect reduced-motion preferences.

## Run locally

Install Node.js 22 or newer, then use the lockfile for a reproducible setup:

```sh
cd cmdream-studio
npm ci
npm run dev
```

Open the local address printed by Vite. The landing page is `/`; the workspace is `/studio.html`.

Run the desktop app during development:

```sh
cd cmdream-studio
npm run desktop
```

Run the tests and production website build:

```sh
cd cmdream-studio
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

## Download and publish desktop releases

The Download Center links directly to the installer files attached to the repository's [GitHub Releases](https://github.com/official-mano/cmdream-studio/releases). No separate storage bucket, provider account, API token, or website upload is needed. The site reads its bundled catalog; it does not call GitHub for product or release information.

To publish a new desktop version:

1. Update the version in `cmdream-studio/package.json` and `cmdream-studio/src/product-info.json`, and keep them in sync. Electron Builder also requires the project homepage and Linux package maintainer metadata in `package.json`.
2. Commit and push those changes to GitHub.
3. Create and push a matching, unused version tag. For version `1.3.2`, for example:

   ```sh
   git tag v1.3.2
   git push origin v1.3.2
   ```

4. In GitHub, open the repository's **Actions** tab and wait for **Build desktop downloads** to finish. It tests and builds Windows, Linux, and macOS packages, creates a GitHub Release with the files attached, and updates the download catalog. Render then deploys the updated catalog.

To download manually, visit the [GitHub Releases page](https://github.com/official-mano/cmdream-studio/releases), select a version, and choose the file for your operating system and processor. The Download Center provides direct links after the workflow completes. If downloads are unavailable, check the Actions run and the release assets for that version.

Release publishing uses the repository's standard GitHub Actions token and needs no additional secrets. The workflow refuses to create a release if any expected package is missing.

## Deploy the website on Render

1. Keep `.github/workflows/`, `render.yaml`, and the `cmdream-studio/` application folder at the repository root. In Render, choose **New → Blueprint** and connect the repository, or create a Static Site manually with root directory `cmdream-studio`, build command `npm ci --include=dev && npm run build`, and publish directory `dist`.
2. Render assigns and displays the site's public URL in its dashboard, typically an `onrender.com` hostname. The exact hostname depends on availability; use the actual value shown in Render if configuring a custom domain or provider allowlist.
3. To use a custom domain you control, open the static site's **Settings → Custom Domains**, add the hostname, and follow the DNS and TLS instructions Render provides.

Render hosts the public site, not an Ollama server. A Render-hosted site cannot connect to Ollama running on a visitor's computer. Ollama support is desktop-only.

## Desktop release builds

The app is in the `cmdream-studio/` subfolder, so GitHub Actions is at `.github/workflows/desktop-builds.yml`. It runs the app's build commands and builds:

- Windows x64 and ARM64 installers `.exe` with desktop and Start Menu shortcuts
- Portable Windows x64 and ARM64 `.exe`
- Linux x86_64 `.AppImage` and Debian `.deb` packages
- macOS Intel and Apple silicon `.dmg` installers and `.zip` app bundles

Update the package version and catalog release notes, commit and push, then tag that commit:

```sh
git tag v1.3.2
git push origin v1.3.2
```

Pushing a `v*` tag runs the Windows, Linux, and macOS builds, creates a GitHub Release with the installer assets, and updates the website download catalog. Make sure the package version matches the tag. A tag can only be created once; use a new version if that tag already exists.

The Windows and macOS builds are not code-signed. Windows may show a SmartScreen warning, and macOS may block the first launch, until you sign builds with certificates you control. The Windows installer creates shortcuts and an uninstaller; removing the app leaves its local scene history in the user profile.

## Scene plans and renderer

Plans are JSON data only. Version 2 scene plans add an allowlisted layer stack, a low/medium/high/extra/max detail value, bounded per-subject form settings, and easing phases for the animation. Custom subjects can be represented by a limited set of normalized-coordinate primitives (lines, rectangles, ellipses, triangles, hearts, and polylines) with allowlisted colors, glyphs, and motions. The validator clamps numeric values and rejects unsupported properties, shapes, and animation parts. Older version 1 history entries are upgraded when loaded. The renderer consumes only the normalized plan; it never interprets JavaScript, HTML, shell commands, or model-generated drawing instructions. Standalone HTML exports embed the same fixed renderer and validated scene data.

The renderer gives each supported subject its own structure rather than filling the canvas with generic symbols. A rose has nested petal layers, shaded folds, a pollen center, a curved stem, veined leaves, and a grounded base. Its stem, leaves, outer petals, middle petals, inner petals, and stamens enter in overlapping phases; the bloom holds, then closes gently before the loop. Fireworks expand and fade radially, rings rotate with facet highlights, and houses include a roof, walls, door, windows, and changing interior light. Background stars use sparse depth layers and restrained twinkle/parallax.

Detail is selectable in the workspace and saved into each scene plan:

| Detail | Example rose plan | Render treatment |
|---|---|---|
| Low | `DETAIL_EXAMPLES.low` in `cmdream-studio/src/scene.js` | Sparse stars and particles, simple shading, and fewer subject accents. |
| Medium | `DETAIL_EXAMPLES.medium` in `cmdream-studio/src/scene.js` | More contours, shading, foliage veins, and background depth. |
| High | `DETAIL_EXAMPLES.high` in `cmdream-studio/src/scene.js` | Full subject detail, layered shading, highlights, and balanced particles. |
| Extra | `DETAIL_EXAMPLES.extra` in `cmdream-studio/src/scene.js` | Denser textures, finer contours, more subject accents, and additional particles. |
| Max | `DETAIL_EXAMPLES.max` in `cmdream-studio/src/scene.js` | Maximum bounded detail, depth, shading, highlights, and motion accents. |

These are complete, validated scene plans for the same rose prompt; only their `detail` field differs. The same shared levels are available for every built-in and custom subject. They can be inspected with `DETAIL_EXAMPLES` in the source or composed in the workspace at each setting.

Scene history and non-secret provider preferences (selected composer, model IDs, endpoints, and API version) are stored in local browser storage on that device. API keys are held in memory only and are never stored. In the desktop app, Chromium's application profile keeps this local data between launches. The Windows uninstaller removes the app but leaves this local data in place.

## Repository

```text
repository-root/
├── .github/workflows/desktop-builds.yml  # GitHub Actions; must be at this level
├── .gitignore
├── LICENSE
├── README.md
├── cmdream-studio.zip          # Source archive for sharing
├── render.yaml                 # Render Blueprint; app root is cmdream-studio/
└── cmdream-studio/
    ├── electron/               # Desktop shell and local Ollama bridge
    ├── src/                    # Fixed renderer, scene contract, provider adapters, UI
    ├── tests/
    ├── assets/                 # App icons
    ├── scripts/                # Download publishing scripts
    ├── index.html              # Public-facing landing page
    ├── about.html              # Product overview
    ├── studio.html             # Animation workspace
    ├── downloads.html          # Product catalog and direct file-host links
    ├── guide.html              # User documentation and project status
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```

The app source and its lockfile live only in `cmdream-studio/`; the root holds repository-level documentation, deployment configuration, and the release workflow.

## License

MIT. See [LICENSE](./LICENSE).
