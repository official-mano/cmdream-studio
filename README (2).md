# CMDream Studio

**Command-line art in motion.**

CMDream Studio turns animation descriptions into looping, colored terminal art. A built-in offline composer creates supported scenes; optional AI providers return constrained JSON plans that a fixed renderer validates and draws. Model-generated code is never executed.

## Product

- **Website:** deploy the static site through the root `render.yaml`; Render displays the assigned public URL in its dashboard.
- **Workspace:** `studio.html` in the built site.
- **Download center:** the built site's `downloads.html` reads version details from `cmdream-studio/src/product-info.json` and downloads from the configured product file host. The site does not query GitHub.
- **Documentation:** [application README](./cmdream-studio/README.md) and the built site's `guide.html`.
- **Desktop builds:** the GitHub Actions workflow builds repository-owner artifacts. Public website downloads are uploaded separately to the configured Cloudflare R2 domain.

The Render Blueprint is at the repository root. The application source and npm project are in `cmdream-studio/`. Supabase and Cloudflare R2 require owner-managed configuration. This project does not publish, deploy, or configure external services for you.

## Repository and website privacy

The source repository can be private while Render has permission to deploy it. A Render Static Site is still served from a public `onrender.com` address; GitHub repository privacy does not make the deployed website private. The optional account page controls scene syncing only, not access to the website. See [Render’s Static Sites documentation](https://render.com/docs/static-sites) before sharing the deployed URL.

## Run locally

Install Node.js 22 or newer, then:

```sh
cd cmdream-studio
npm ci
npm run dev
```

Run tests and build the static website:

```sh
npm test
npm run build
```

Build the desktop app from the same directory with `npm run dist:windows` (Windows x64 and ARM64) or `npm run dist:linux` (Linux x86_64). See the [app README](./cmdream-studio/README.md) for account setup, R2 publishing, deployment, packaging, and release-tag instructions.

## AI and privacy

The offline composer works without an account, model, or network connection. Optional Supabase accounts sync scene prompts and plans with owner-only access; sync is not required for local history. Ollama integration is available in the desktop app; model software and weights must be installed separately. Optional cloud providers receive prompts and API keys directly when selected. CMDream does not receive or save provider API keys.

A Render-hosted website cannot connect to Ollama running on a visitor's computer. Windows x64 and ARM64 packages are built but unsigned.

## License

MIT. See [LICENSE](./cmdream-studio/LICENSE).
