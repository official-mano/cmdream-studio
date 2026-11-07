import { parseSceneResponse } from "./scene.js";

export const DEFAULT_CONFIG = {
  offline: { model: "Built-in composer" },
  ollama: { endpoint: "http://127.0.0.1:11434", model: "llama3.2" },
  openai: { endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini", key: "" },
  anthropic: { endpoint: "https://api.anthropic.com", model: "claude-3-5-haiku-latest", key: "" },
  gemini: { endpoint: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash", key: "" },
  azure: { endpoint: "", model: "", key: "", apiVersion: "2024-10-21" },
  compatible: { endpoint: "", model: "", key: "" }
};

const sceneContract = `Return one JSON object only, with exactly these fields and no markdown:
{"version":2,"title":"short title","description":"one sentence","duration":8,"fps":24,"loop":true,"palette":"garden","motifs":["flower"],"layers":["background","subject","foreground","particles"],"detail":"high","form":{"flower":{"type":"rose","parts":["outer-petals","middle-petals","inner-petals","stamens","stem","leaves","thorns"],"outerPetals":10,"middlePetals":8,"innerPetals":6,"leaves":3,"stamens":7}},"phases":[{"part":"outer-petals","start":0.2,"end":0.49,"easing":"ease-out"}]}
Allowed motifs: flower, ring, fireworks, stars, smoke, waves, house. Use 1-4 unique motifs. Allowed palette names: garden, cosmic, festival, ocean, ember, phosphor, amber, ice. Allowed layers: background, subject, foreground, particles. Detail must be low, medium, or high. Describe only forms for motifs you selected. Form fields: flower {type:"rose",parts: allowed flower parts, outerPetals:1-14,middlePetals:1-14,innerPetals:1-12,leaves:1-4,stamens:1-10}; ring {type:"faceted",parts:["rings","facets","orbit"],facets:1-20,rings:1-3}; fireworks {type:"radial",parts:["bursts","trails"],bursts:1-4,rays:1-20}; house {type:"cottage",parts:["roof","walls","door","windows","chimney"],floors:1-2,windows:1-6}; stars {type:"constellation",parts:["stars","depth"],stars:1-48}; smoke {type:"ribbon",parts:["drift","wisps"],wisps:1-14}; waves {type:"tidal",parts:["crests","foam","depth"],crests:1-5}. Allowed flower parts: outer-petals, middle-petals, inner-petals, stamens, stem, leaves, thorns. Motion phases may use only stem-settle, leaves-unfurl, outer-petals, middle-petals, inner-petals, stamens, ring-turn, bursts, window-light, wave-flow, smoke-drift. Each phase has only part, start (0-0.98), end (0.02-1), easing (smooth, ease-in, ease-out). Use at most 12 phases and overlap flower phases so the outer, middle, and inner petals open in sequence. Duration must be 4-20 seconds; fps 8-30; loop must be true. The renderer clamps numeric values and draws all art itself. Return scene data only: never return code, scripts, markup, instructions, or extra fields. Create only a looping ASCII animation scene.`;

function makePrompt(prompt, detail = "high") {
  return `${sceneContract}\n\nRequested detail level: ${detail}. Keep the composition legible at terminal size; use this order for a rose: settle stem, unfurl leaves, open outer petals, middle petals, inner petals and stamens, hold the open rose, then ease back to a closed bud before the loop. Give each subject its own recognizable structure.\n\nAnimation request: ${prompt}`;
}

async function responseJson(response) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Provider request failed (${response.status}): ${body.slice(0, 360) || response.statusText}`);
  }
  return response.json();
}

async function cloudRequest(provider, config, prompt, detail) {
  const headers = { "content-type": "application/json" };
  let url;
  let body;

  if (provider === "openai" || provider === "compatible") {
    const endpoint = config.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint || !config.model.trim() || !config.key.trim()) throw new Error("Enter an endpoint, model ID, and API key in Settings.");
    url = `${endpoint}/chat/completions`;
    headers.authorization = `Bearer ${config.key.trim()}`;
    body = { model: config.model.trim(), messages: [{ role: "user", content: makePrompt(prompt, detail) }], temperature: 0.4, response_format: { type: "json_object" } };
  } else if (provider === "anthropic") {
    const endpoint = config.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint || !config.model.trim() || !config.key.trim()) throw new Error("Enter an endpoint, model ID, and API key in Settings.");
    url = `${endpoint}/v1/messages`;
    headers["x-api-key"] = config.key.trim();
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = { model: config.model.trim(), max_tokens: 1200, temperature: 0.4, messages: [{ role: "user", content: makePrompt(prompt, detail) }] };
  } else if (provider === "gemini") {
    const endpoint = config.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint || !config.model.trim() || !config.key.trim()) throw new Error("Enter an endpoint, model ID, and API key in Settings.");
    url = `${endpoint}/models/${encodeURIComponent(config.model.trim())}:generateContent?key=${encodeURIComponent(config.key.trim())}`;
    body = { contents: [{ parts: [{ text: makePrompt(prompt, detail) }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } };
  } else if (provider === "azure") {
    const endpoint = config.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint || !config.model.trim() || !config.key.trim()) throw new Error("Enter your Azure endpoint, deployment/model ID, and API key in Settings.");
    url = `${endpoint}/openai/deployments/${encodeURIComponent(config.model.trim())}/chat/completions?api-version=${encodeURIComponent(config.apiVersion.trim() || "2024-10-21")}`;
    headers["api-key"] = config.key.trim();
    body = { messages: [{ role: "user", content: makePrompt(prompt, detail) }], temperature: 0.4, response_format: { type: "json_object" } };
  } else {
    throw new Error("Select an available AI composer in Settings.");
  }

  const bodyText = JSON.stringify(body);
  let data;
  if (window.cmdream?.cloudRequest) {
    const result = await window.cmdream.cloudRequest({ provider, url, headers, body: bodyText });
    if (!result?.ok) throw new Error(result?.error || "Cloud provider request failed.");
    data = result.data;
  } else {
    data = await responseJson(await fetch(url, { method: "POST", headers, body: bodyText }));
  }
  if (provider === "gemini") return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (provider === "anthropic") return data?.content?.map((part) => part.text || "").join("") || "";
  return data?.choices?.[0]?.message?.content || "";
}

async function ollamaRequest(config, prompt, detail) {
  const endpoint = config.endpoint.trim().replace(/\/+$/, "");
  const model = config.model.trim();
  if (!model) throw new Error("Choose an Ollama model in Settings.");
  if (window.cmdream?.ollamaGenerate) {
    const result = await window.cmdream.ollamaGenerate({ endpoint, model, prompt: makePrompt(prompt, detail) });
    if (!result?.ok) throw new Error(result?.error || "Could not reach Ollama.");
    return result.text || "";
  }
  throw new Error("Ollama is available through the desktop app only. A Render-hosted site cannot connect to Ollama running on a visitor's computer.");
}

export async function composeWithProvider(provider, config, prompt, detail = "high") {
  const response = provider === "offline"
    ? ""
    : provider === "ollama"
      ? await ollamaRequest(config, prompt, detail)
      : await cloudRequest(provider, config, prompt, detail);
  return parseSceneResponse(response);
}

export async function testProvider(provider, config) {
  if (provider === "offline") return "Offline composer is ready—no connection required.";
  if (provider === "ollama" && window.cmdream?.ollamaModels) {
    const result = await window.cmdream.ollamaModels({ endpoint: config.endpoint });
    if (!result?.ok) throw new Error(result?.error || "Could not reach Ollama.");
    const models = result.models || [];
    if (!models.length) throw new Error("Ollama is running but has no downloaded models. Pull a model such as llama3.2 and try again.");
    return `Connected to Ollama. ${models.length} model${models.length === 1 ? "" : "s"} available.`;
  }
  await composeWithProvider(provider, config, "A small scene with three twinkling stars.");
  return "Connection succeeded and the provider returned a valid scene plan.";
}
