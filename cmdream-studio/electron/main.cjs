const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");

app.setName("CMDream Studio");

let mainWindow;

function openPage(fileName) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", fileName));
  }
}

function installApplicationMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Home", click: () => openPage("index.html") },
        { label: "Animation workspace", click: () => openPage("studio.html") },
        { type: "separator" },
        { label: "About CMDream Studio", click: () => openPage("about.html") },
        { label: "Documentation", click: () => openPage("guide.html") },
        { label: "Downloads", click: () => openPage("downloads.html") },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    }
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function cloudEndpoint(provider, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid provider endpoint.");
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Cloud provider endpoints must use HTTPS and cannot include URL credentials.");
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "localhost.", "::1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Cloud provider endpoints cannot target this computer or a local network hostname.");
  }
  const exactHosts = {
    openai: "api.openai.com",
    anthropic: "api.anthropic.com",
    gemini: "generativelanguage.googleapis.com"
  };
  if (exactHosts[provider] && hostname !== exactHosts[provider]) throw new Error(`Use the official ${provider} API host, or configure a compatible endpoint.`);
  const ipVersion = require("node:net").isIP(hostname);
  if (ipVersion === 4) {
    const first = Number(hostname.split(".")[0]);
    const second = Number(hostname.split(".")[1]);
    if (first === 0 || first === 10 || first === 127 || first >= 224 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) {
      throw new Error("Cloud provider endpoints cannot target private or reserved IP addresses.");
    }
  } else if (ipVersion === 6) {
    throw new Error("Use a public HTTPS hostname for cloud provider endpoints.");
  }
  return url;
}

function localOllamaUrl(endpoint, route) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Enter a valid Ollama URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "::1", "localhost"].includes(url.hostname)) {
    throw new Error("For safety, the desktop Ollama connection must use localhost or 127.0.0.1.");
  }
  return new URL(route, `${url.protocol}//${url.host}`).toString();
}

ipcMain.handle("cloud:request", async (_event, input = {}) => {
  try {
    if (!["openai", "anthropic", "gemini", "azure", "compatible"].includes(input.provider)) return { ok: false, error: "Unsupported cloud provider." };
    const url = cloudEndpoint(input.provider, input.url);
    if (typeof input.body !== "string" || input.body.length > 30000) return { ok: false, error: "Provider request is too large." };
    if (!input.headers || typeof input.headers !== "object" || Object.keys(input.headers).some((key) => !["content-type", "authorization", "x-api-key", "anthropic-version", "anthropic-dangerous-direct-browser-access", "api-key"].includes(key.toLowerCase()))) {
      return { ok: false, error: "Provider request contains unsupported headers." };
    }
    const response = await fetch(url, {
      method: "POST",
      headers: input.headers,
      body: input.body,
      redirect: "error",
      signal: AbortSignal.timeout(60000)
    });
    const text = await response.text();
    if (text.length > 2000000) return { ok: false, error: "Provider response was too large." };
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Provider returned a non-JSON response (HTTP ${response.status}).` };
    }
    if (!response.ok) return { ok: false, error: `Provider request failed (${response.status}): ${(data.error?.message || data.message || response.statusText).slice(0, 360)}` };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: `Cloud provider request failed: ${error.message}` };
  }
});

ipcMain.handle("ollama:models", async (_event, input = {}) => {
  try {
    const response = await fetch(localOllamaUrl(input.endpoint, "/api/tags"), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, error: `Ollama returned HTTP ${response.status}.` };
    const data = await response.json();
    return { ok: true, models: (data.models || []).map((model) => model.name).filter(Boolean) };
  } catch (error) {
    return { ok: false, error: `Could not connect to Ollama: ${error.message}` };
  }
});

ipcMain.handle("ollama:generate", async (_event, input = {}) => {
  try {
    if (typeof input.prompt !== "string" || input.prompt.length > 5000) return { ok: false, error: "Prompt must be 5,000 characters or fewer." };
    if (typeof input.model !== "string" || !input.model.trim() || input.model.length > 120) return { ok: false, error: "Enter a valid Ollama model ID." };
    const response = await fetch(localOllamaUrl(input.endpoint, "/api/generate"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: input.model.trim(), prompt: input.prompt, stream: false, format: "json" }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) return { ok: false, error: `Ollama returned HTTP ${response.status}: ${(await response.text()).slice(0, 240)}` };
    const data = await response.json();
    return { ok: true, text: data.response || "" };
  } catch (error) {
    return { ok: false, error: `Could not generate with Ollama: ${error.message}` };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 850,
    minHeight: 650,
    backgroundColor: "#0a0e0e",
    title: `${app.name} — Animation Studio`,
    icon: path.join(__dirname, "..", "assets", process.platform === "win32" ? "cmdream-icon.ico" : "cmdream-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  installApplicationMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
