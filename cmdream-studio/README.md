# CMDream Studio

**Command-line art in motion.**

CMDream Studio turns a plain-language animation idea into a small, validated JSON scene plan, then draws every frame with a fixed ASCII renderer. The model never returns executable code, and model output is never evaluated or executed.

The repository contains a public-facing website, animation workspace (`studio.html`), download center (`downloads.html`), user guide (`guide.html`), and account page, plus an Electron desktop app. The website is static; the download center reads the bundled `src/product-info.json` catalog and links directly to the configured public file host. It does not call GitHub for product or release data. The desktop app adds a tightly scoped local Ollama bridge.

## What it does

- Animate flowers, hearts, rings, fireworks, stars, smoke, waves, and houses with a layered, smooth-looping ASCII renderer, prompt-matched color and a near-black CRT-inspired terminal preview. Offline scene descriptions retain the requested idea and pick a compatible palette from color and mood words.
- Ask a configured AI composer for other subjects: it returns a bounded illustration plan made of safe shapes, which the fixed renderer draws without running model code.
- Choose low, medium, high, extra, or max detail; each level applies consistently across every supported subject.
- Turn on **Fine detail** in the terminal preview to shrink the display glyphs and render a resize-aware grid up to 240×60; turn it off for the larger, standard preview.
- Compose scenes offline without an account, model, or API key.
- Use a local Ollama model from the desktop app.
- Optionally connect OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, or an OpenAI-compatible provider.
- Preview, pause, restart, seek, change playback speed, revisit recent scenes, and export scene JSON or standalone HTML.
- Use the Windows/macOS/Linux desktop app's native menus to move between the workspace, account, downloads, and documentation.
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

## Accounts and optional scene sync

Accounts are optional. Without Supabase configuration, the offline composer, local history, and desktop app continue to work; account sign-in is unavailable.

1. Create a Supabase project and run `supabase/migrations/20261108190000_user_scenes.sql` in its SQL editor.
2. In Supabase Auth, set the site URL to your actual hosted site and add that origin plus `/account.html` to the allowed redirect URLs. Set up email confirmation and a working SMTP provider before enabling public sign-up. Review Supabase's authentication rate limits before opening sign-up publicly.
3. Configure the site's build environment with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the Supabase publishable/anon key only), and `VITE_PUBLIC_SITE_URL`. Never use the service-role key in the site or desktop app. For local development, copy `.env.example` to `.env.local` and fill in the same values.

The Supabase database uses row-level security so authenticated users can access only their own scene rows. The app syncs at most 100 scenes. Passwords and auth tokens are handled by Supabase; synced scene prompts and scene JSON are stored there, but provider API keys are never included. If an account service is not configured for the web and desktop builds, sign-in/sign-up is unavailable; this does not disable offline use.

For desktop builds produced by GitHub Actions, add the same three **public configuration values** under repository **Settings → Secrets and variables → Actions → Variables** with the exact names above. These values are compiled into the app; do not put a Supabase service-role/secret key in any variable or secret.

## Publish desktop downloads to Cloudflare R2

The website's version, notes, file names, sizes, checksums, and URLs come from `src/product-info.json`. An empty URL means that package has not been published; the website disables that download instead of showing a broken link. To make files available:

1. Create a Cloudflare R2 bucket and attach a public custom domain you control. Configure HTTPS and CORS as needed for browser downloads. Keep write credentials private. Until this setup is complete and the product catalog has public URLs, the download buttons remain unavailable.
2. Update `version` in `package.json`, the matching file names/version and release notes in `src/product-info.json`, then commit and push. A matching `v*` tag triggers the desktop builds.
3. From GitHub Actions, download the `windows-downloads` and `linux-downloads` artifacts for the same workflow run. They are build artifacts for the repository owner, not public product downloads. Put all five `.exe` and `.AppImage` files in `cmdream-studio/release/`.
4. In a local PowerShell session, set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` as environment variables. Use an R2 token scoped to the target bucket with object read/write permission. Do not paste credentials into chat, commit them, or set them as public Vite variables.
5. From `cmdream-studio/`, run `npm run publish:downloads`. The script validates the artifacts, uploads them under versioned object keys, computes SHA-256 checksums, and updates `src/product-info.json`. Review and commit that JSON file, then let Render deploy the updated website. It prints no secrets.

The uploader publishes every expected package it finds and skips missing builds, so Windows downloads can be published before the Linux AppImage is available. The catalog explicitly leaves skipped packages unavailable for that version. It may leave already uploaded objects in R2 if a later upload fails; the site catalog is updated only after all present uploads finish. Re-running the command safely replaces the same versioned object keys. Direct downloads are served by the configured R2 public domain—not by GitHub.

## Deploy the website on Render

1. Keep the repository-root `.github/workflows/`, `render.yaml`, and `cmdream-studio/` layout. In Render, choose **New → Blueprint** and connect the repository, or create a Static Site manually with root directory `cmdream-studio`, build command `npm ci --include=dev && npm run build`, and publish directory `dist`.
2. Configure the Supabase build environment variables above if you want sign-in enabled. The site can also build without them; account sync will remain unavailable.
3. Render assigns and displays the site's public URL in its dashboard, typically an `onrender.com` hostname. The exact hostname depends on availability; use the actual value shown in Render for `VITE_PUBLIC_SITE_URL` and Supabase redirect configuration. Redeploy after changing build-time variables.
4. To use a custom domain you control, open the static site's **Settings → Custom Domains**, add the hostname, and follow the DNS and TLS instructions Render provides.

Render hosts the public site, not an Ollama server. A Render-hosted site cannot connect to Ollama running on a visitor's computer. Ollama support is desktop-only.

## Desktop release builds

The app is in the `cmdream-studio/` subfolder, so GitHub Actions is at `.github/workflows/desktop-builds.yml`. It runs the app's build commands and builds:

- Windows x64 and ARM64 installers `.exe` (NSIS)
- Portable Windows x64 and ARM64 `.exe`
- Linux x86_64 `.AppImage`

Update the package version and catalog release notes, commit and push, then tag that commit:

```sh
git tag v1.1.1
git push origin v1.1.1
```

Pushing a `v*` tag runs the Windows and Linux builds and uploads workflow artifacts for the repository. It does not create GitHub Releases and is not the public download host. Run the R2 publishing steps above to make website downloads available.

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

Scene history and non-secret provider preferences (selected composer, model IDs, endpoints, and API version) are stored in local browser storage on that device. API keys are held in memory only and are never stored. In the desktop app, Chromium's application profile keeps this local data between launches; uninstalling the app may remove application data depending on the uninstall option used.

## Repository

```text
repository-root/
├── .github/workflows/desktop-builds.yml  # GitHub Actions; must be at this level
├── render.yaml                 # Render Blueprint; app root is cmdream-studio/
└── cmdream-studio/
    ├── electron/               # Desktop shell and local Ollama bridge
    ├── src/                    # Fixed renderer, scene contract, provider adapters, UI
    ├── tests/
    ├── index.html              # Public-facing landing page
    ├── studio.html             # Animation workspace
    ├── downloads.html          # Product catalog and direct file-host links
    ├── guide.html              # User documentation and project status
    ├── package.json
    └── vite.config.js
```

## License

MIT. See [LICENSE](./LICENSE).
