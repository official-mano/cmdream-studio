import "./styles.css";
import { composeOffline, validateScene } from "./scene.js";
import { colorizeFrame, createStandaloneHtml } from "./renderer.js";
import { DEFAULT_CONFIG, composeWithProvider, testProvider } from "./providers.js";

const $ = (selector) => document.querySelector(selector);
const promptInput = $("#prompt");
const output = $("#animation-output");
const emptyState = $("#empty-state");
const statusMessage = $("#status-message");
const dialog = $("#settings-dialog");
const HISTORY_KEY = "cmdream-studio-scenes-v1";
const configs = Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([name, value]) => [name, { ...value }]));
let activeProvider = "offline";
let draftProvider = "offline";
let scene = null;
let history = [];
let activeHistoryAt = null;
let paused = false;
let playbackSpeed = 1;
let playhead = 0;
let lastFrame = 0;
let startedAt = performance.now();

function showStatus(message, kind = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function sceneItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(stored)) throw new Error("Scene history has an unexpected format.");
    history = stored.slice(0, 30).map((item) => ({
      scene: validateScene(item.scene),
      prompt: String(item.prompt || "").slice(0, 700),
      createdAt: Number(item.createdAt) || Date.now()
    }));
  } catch (error) {
    history = [];
    showStatus(`Scene history could not be loaded: ${error.message}`, "error");
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  } catch (error) {
    showStatus(`This browser could not save scene history: ${error.message}`, "error");
  }
}

function drawHistory() {
  const list = $("#history-list");
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Your created scenes will find a home here.";
    list.append(empty);
    return;
  }
  history.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";
    button.setAttribute("aria-current", activeHistoryAt === item.createdAt ? "true" : "false");
    const icon = document.createElement("span");
    icon.className = "history-icon";
    icon.textContent = item.scene.motifs[0] === "flower" ? "✳" : item.scene.motifs[0] === "ring" ? "◌" : item.scene.motifs[0] === "waves" ? "≈" : "✦";
    const details = document.createElement("span");
    details.className = "history-details";
    const title = document.createElement("strong");
    title.textContent = item.scene.title;
    const date = document.createElement("small");
    date.textContent = new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    details.append(title, date);
    button.append(icon, details);
    button.addEventListener("click", () => loadHistoryItem(index));
    list.append(button);
  });
}

function loadHistoryItem(index) {
  const item = history[index];
  if (!item) return;
  activeHistoryAt = item.createdAt;
  scene = item.scene;
  promptInput.value = item.prompt;
  $("#char-count").textContent = `${promptInput.value.length} / 700`;
  showScene(scene, false);
  drawHistory();
}

function showScene(nextScene, addToHistory = true) {
  scene = validateScene(nextScene);
  paused = false;
  playhead = 0;
  startedAt = performance.now();
  output.classList.remove("hidden");
  emptyState.classList.add("hidden");
  $("#scene-title").textContent = scene.title.toUpperCase();
  $("#terminal-command").textContent = `render --loop --scene "${scene.title}"`;
  $("#scene-description").textContent = scene.description;
  $("#detail-select").value = scene.detail;
  $("#play-toggle").textContent = "Ⅱ";
  $("#play-toggle").setAttribute("aria-label", "Pause animation");
  $("#play-toggle").disabled = false;
  $("#restart").disabled = false;
  $("#seek").disabled = false;
  $("#speed-select").disabled = false;
  $("#seek").value = "0";
  $("#time-label").textContent = `00:${String(Math.floor(scene.duration)).padStart(2, "0")}`;
  $("#download-json").disabled = false;
  $("#download-html").disabled = false;
  $("#scene-code").textContent = JSON.stringify(scene, null, 2);
  if (addToHistory) {
    activeHistoryAt = Date.now();
    history.unshift({ scene, prompt: promptInput.value.trim(), createdAt: activeHistoryAt });
    history = history.slice(0, 30);
    saveHistory();
    drawHistory();
  }
}

function exportFile(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "cmdream-scene";
}

function frameSize() {
  const screen = output.closest(".terminal-screen");
  const fineDetail = screen.classList.contains("fine-detail");
  const fontSize = Number.parseFloat(getComputedStyle(output).fontSize) || 10;
  const lineHeight = Number.parseFloat(getComputedStyle(output).lineHeight) || fontSize * 1.26;
  const columns = Math.max(64, Math.min(fineDetail ? 240 : 120, Math.floor((screen.clientWidth - 44) / (fontSize * 0.61))));
  const rows = Math.max(24, Math.min(fineDetail ? 60 : 40, Math.floor((screen.clientHeight - 70) / lineHeight)));
  return { columns, rows };
}

function drawFrameAt(position) {
  const { columns, rows } = frameSize();
  output.innerHTML = colorizeFrame(scene, "", position, columns, rows);
  $("#terminal-size").textContent = `${columns} × ${rows}`;
}

function setProviderLabel() {
  const labels = { offline: "Offline composer", ollama: `Ollama · ${configs.ollama.model}`, openai: `OpenAI · ${configs.openai.model}`, anthropic: `Claude · ${configs.anthropic.model}`, gemini: `Gemini · ${configs.gemini.model}`, azure: `Azure · ${configs.azure.model || "deployment"}`, compatible: `Compatible · ${configs.compatible.model || "model"}` };
  const badge = $("#active-model");
  badge.dataset.provider = activeProvider;
  badge.title = activeProvider === "offline"
    ? "Built-in scene composer. Your prompt stays on this device."
    : `Selected composer: ${labels[activeProvider]}`;
  $("#active-model-label").textContent = labels[activeProvider];
}

function addField(container, label, key, value, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = "field-label";
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.className = "field-control";
  input.type = options.secret ? "password" : "text";
  input.autocomplete = options.secret ? "new-password" : "off";
  input.spellcheck = false;
  input.value = value || "";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.list) input.setAttribute("list", options.list);
  input.addEventListener("input", () => { configs[draftProvider][key] = input.value; });
  wrapper.append(input);
  container.append(wrapper);
}

function renderProviderFields() {
  const provider = $("#provider-select").value;
  draftProvider = provider;
  const container = $("#provider-fields");
  const warning = $("#provider-warning");
  container.replaceChildren();
  warning.textContent = "";
  if (provider === "offline") {
    warning.textContent = "Works immediately and completely offline. No prompt or key leaves this device.";
    return;
  }
  if (provider === "ollama") {
    const config = configs.ollama;
    addField(container, "OLLAMA ADDRESS", "endpoint", config.endpoint, { placeholder: "http://127.0.0.1:11434" });
    addField(container, "MODEL ID", "model", config.model, { placeholder: "llama3.2", list: "ollama-models" });
    const models = document.createElement("datalist");
    models.id = "ollama-models";
    ["llama3.2", "qwen2.5", "mistral", "gemma3"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      models.append(option);
    });
    container.append(models);
    warning.textContent = window.cmdream
      ? "Ollama runs on this computer; prompts go to localhost only. Download Ollama and a model first."
      : "Use the desktop app for local Ollama. A Render-hosted site cannot connect to Ollama running on a visitor’s PC.";
    return;
  }
  const config = configs[provider];
  const endpoints = {
    openai: ["API BASE URL", config.endpoint, "https://api.openai.com/v1"],
    anthropic: ["API BASE URL", config.endpoint, "https://api.anthropic.com"],
    gemini: ["API BASE URL", config.endpoint, "https://generativelanguage.googleapis.com/v1beta"],
    azure: ["AZURE RESOURCE ENDPOINT", config.endpoint, "https://your-resource.openai.azure.com"],
    compatible: ["OPENAI-COMPATIBLE BASE URL", config.endpoint, "https://provider.example/v1"]
  };
  const [endpointLabel, endpoint, placeholder] = endpoints[provider];
  addField(container, endpointLabel, "endpoint", endpoint, { placeholder });
  addField(container, provider === "azure" ? "DEPLOYMENT NAME" : "MODEL ID", "model", config.model, {
    placeholder: provider === "openai" ? "gpt-4o-mini" : provider === "anthropic" ? "claude-3-5-haiku-latest" : provider === "gemini" ? "gemini-2.0-flash" : "model-id"
  });
  if (provider === "azure") addField(container, "API VERSION", "apiVersion", config.apiVersion, { placeholder: "2024-10-21" });
  addField(container, "API KEY", "key", config.key, { secret: true, placeholder: "Entered for this session only" });
  warning.textContent = "Your prompt and key are sent to this provider when you compose or test. No CMDream server receives them, and credentials are not saved.";
}

function renderLoop(now) {
  requestAnimationFrame(renderLoop);
  if (!scene || paused || now - lastFrame < 1000 / Math.min(scene.fps, 24)) return;
  lastFrame = now;
  const elapsed = playhead + ((now - startedAt) / 1000) * playbackSpeed;
  const position = elapsed % scene.duration;
  drawFrameAt(position);
  $("#seek").value = String(Math.round(position / scene.duration * 1000));
  $("#time-label").textContent = `00:${String(Math.ceil(scene.duration - position)).padStart(2, "0")}`;
}

$("#prompt").addEventListener("input", () => { $("#char-count").textContent = `${promptInput.value.length} / 700`; });
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
  promptInput.value = button.dataset.prompt;
  promptInput.focus();
  $("#char-count").textContent = `${promptInput.value.length} / 700`;
}));

$("#prompt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showStatus("Write a short animation idea before composing.", "error");
    promptInput.focus();
    return;
  }
  const button = $("#create-button");
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Composing…';
  showStatus(activeProvider === "offline" ? "Composing your scene on this device…" : `Asking ${activeProvider} for a scene plan…`);
  try {
    const detail = $("#detail-select").value;
    const result = activeProvider === "offline"
      ? composeOffline(prompt, detail)
      : await composeWithProvider(activeProvider, configs[activeProvider], prompt, detail);
    showScene({ ...result, detail });
    showStatus(`“${result.title}” is ready to play.`, "success");
  } catch (error) {
    showStatus(`Scene not created: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = "Compose scene <span>→</span>";
  }
});

$("#settings-open").addEventListener("click", () => {
  $("#provider-select").value = activeProvider;
  renderProviderFields();
  $("#connection-status").textContent = "";
  dialog.showModal();
});
$("#provider-select").addEventListener("change", renderProviderFields);
$("#detail-select").addEventListener("change", () => {
  if (!scene) return;
  scene = validateScene({ ...scene, detail: $("#detail-select").value });
  $("#scene-code").textContent = JSON.stringify(scene, null, 2);
  const index = history.findIndex((item) => item.createdAt === activeHistoryAt);
  if (index >= 0) {
    history[index].scene = scene;
    saveHistory();
  }
});
$("#test-connection").addEventListener("click", async () => {
  const button = $("#test-connection");
  button.disabled = true;
  $("#connection-status").textContent = "Checking…";
  $("#connection-status").dataset.kind = "info";
  try {
    const result = await testProvider(draftProvider, configs[draftProvider]);
    $("#connection-status").textContent = result;
    $("#connection-status").dataset.kind = "success";
  } catch (error) {
    $("#connection-status").textContent = error.message;
    $("#connection-status").dataset.kind = "error";
  } finally {
    button.disabled = false;
  }
});
$("#save-settings").addEventListener("click", () => {
  activeProvider = draftProvider;
  setProviderLabel();
  dialog.close();
  showStatus(`${activeProvider === "offline" ? "Offline composer" : activeProvider} selected. Settings are held in memory only.`, "success");
});

$("#play-toggle").addEventListener("click", () => {
  if (!scene) return;
  if (paused) {
    paused = false;
    startedAt = performance.now();
    $("#play-toggle").textContent = "Ⅱ";
    $("#play-toggle").setAttribute("aria-label", "Pause animation");
  } else {
    playhead = (playhead + ((performance.now() - startedAt) / 1000) * playbackSpeed) % scene.duration;
    paused = true;
    $("#play-toggle").textContent = "▶";
    $("#play-toggle").setAttribute("aria-label", "Play animation");
  }
});
$("#restart").addEventListener("click", () => {
  if (!scene) return;
  playhead = 0;
  startedAt = performance.now();
  paused = false;
  $("#play-toggle").textContent = "Ⅱ";
  $("#play-toggle").setAttribute("aria-label", "Pause animation");
});
$("#speed-select").addEventListener("change", (event) => {
  if (!scene) return;
  if (!paused) playhead = (playhead + ((performance.now() - startedAt) / 1000) * playbackSpeed) % scene.duration;
  playbackSpeed = Number(event.target.value);
  startedAt = performance.now();
});
$("#seek").addEventListener("input", (event) => {
  if (!scene) return;
  playhead = Number(event.target.value) / 1000 * scene.duration;
  startedAt = performance.now();
  drawFrameAt(playhead);
  if (paused) $("#time-label").textContent = `00:${String(Math.ceil(scene.duration - playhead)).padStart(2, "0")}`;
});
$("#detail-toggle").addEventListener("click", (event) => {
  const enabled = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(enabled));
  event.currentTarget.title = enabled
    ? "Fine detail is on: smaller text, denser character grid"
    : "Use a smaller terminal font and a denser character grid";
  $("#preview-screen .terminal-screen").classList.toggle("fine-detail", enabled);
  lastFrame = 0;
  if (!scene) return;
  const position = paused ? playhead : (playhead + ((performance.now() - startedAt) / 1000) * playbackSpeed) % scene.duration;
  drawFrameAt(position);
});
window.addEventListener("resize", () => {
  lastFrame = 0;
  if (!scene) return;
  const position = paused ? playhead : (playhead + ((performance.now() - startedAt) / 1000) * playbackSpeed) % scene.duration;
  drawFrameAt(position);
});
$("#code-toggle").addEventListener("click", () => $("#code-panel").classList.toggle("hidden"));
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await $("#preview-screen").requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    showStatus(`Could not open fullscreen: ${error.message}`, "error");
  }
});
$("#download-json").addEventListener("click", () => {
  if (scene) exportFile(`${fileSlug(scene.title)}.json`, `${JSON.stringify(scene, null, 2)}\n`, "application/json");
});
$("#download-html").addEventListener("click", () => {
  if (scene) exportFile(`${fileSlug(scene.title)}.html`, createStandaloneHtml(scene), "text/html");
});
$("#copy-json").addEventListener("click", async () => {
  if (!scene) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(scene, null, 2));
    showStatus("Scene JSON copied to clipboard.", "success");
  } catch (error) {
    showStatus(`Could not copy scene JSON: ${error.message}`, "error");
  }
});
$("#new-scene").addEventListener("click", () => {
  scene = null;
  activeHistoryAt = null;
  promptInput.value = "";
  $("#char-count").textContent = "0 / 700";
  output.textContent = "";
  output.classList.add("hidden");
  emptyState.classList.remove("hidden");
  $("#scene-title").textContent = "YOUR CANVAS";
  $("#terminal-command").textContent = "waiting for your first scene";
  $("#scene-description").textContent = "Waiting for your first scene.";
  $("#download-json").disabled = true;
  $("#download-html").disabled = true;
  $("#play-toggle").disabled = true;
  $("#restart").disabled = true;
  $("#seek").disabled = true;
  $("#speed-select").disabled = true;
  $("#scene-code").textContent = "Generate a scene to inspect its safe, constrained plan.";
  drawHistory();
});

sceneItems();
drawHistory();
setProviderLabel();
requestAnimationFrame(renderLoop);
