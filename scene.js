export const MOTIFS = ["flower", "heart", "ring", "fireworks", "stars", "smoke", "waves", "house", "custom"];
export const PALETTES = ["garden", "cosmic", "festival", "ocean", "ember", "phosphor", "amber", "ice"];
export const DETAILS = ["low", "medium", "high", "extra", "max"];
export const LAYERS = ["background", "subject", "foreground", "particles"];

const words = {
  flower: /\b(rose|flower|bloom|petal|tulip|daisy|garden)\b/i,
  heart: /\b(heart|hart|hearts|heartbeat)\b/i,
  ring: /\b(ring|orbit|planet|saturn|celestial)\b/i,
  fireworks: /\b(firework|fireworks|burst|sparkl|celebrat)\b/i,
  stars: /\b(star|stars|night|sky|twinkle|constellation|moon)\b/i,
  smoke: /\b(smoke|mist|fog|steam|cloud|drift)\b/i,
  waves: /\b(wave|waves|ocean|sea|water|current|tide)\b/i,
  house: /\b(house|home|cabin|window|cottage|roof)\b/i
};

const PARTS = [
  "stem-settle", "leaves-unfurl", "outer-petals", "middle-petals", "inner-petals",
  "stamens", "ring-turn", "bursts", "window-light", "wave-flow", "smoke-drift", "heart-beat"
];
const EASINGS = ["smooth", "ease-in", "ease-out"];
const FORM_PARTS = {
  flower: ["outer-petals", "middle-petals", "inner-petals", "stamens", "stem", "leaves", "thorns"],
  heart: ["body", "shine", "sparkles"],
  ring: ["rings", "facets", "orbit"],
  fireworks: ["bursts", "trails"],
  house: ["roof", "walls", "door", "windows", "chimney"],
  stars: ["stars", "depth"],
  smoke: ["drift", "wisps"],
  waves: ["crests", "foam", "depth"],
  custom: ["shapes"]
};

const SHAPE_TYPES = ["line", "rect", "ellipse", "triangle", "heart", "polyline"];
const SHAPE_COLORS = ["petal1", "petal2", "petal3", "petal4", "leaf", "vein", "light", "sky1", "sky2", "water", "house"];
const SHAPE_GLYPHS = [".", ":", "'", "-", "=", "+", "*", "#", "@", "/", "\\", "|", "_", "~", "o", "O", "x", "<", ">", "^", "v"];
const SHAPE_MOTIONS = ["none", "pulse", "float", "sway", "orbit"];

const DEFAULT_FORMS = {
  flower: { type: "rose", parts: FORM_PARTS.flower, outerPetals: 10, middlePetals: 8, innerPetals: 6, leaves: 3, stamens: 7 },
  heart: { type: "heart", parts: FORM_PARTS.heart },
  ring: { type: "faceted", parts: ["rings", "facets", "orbit"], facets: 12, rings: 2 },
  fireworks: { type: "radial", parts: ["bursts", "trails"], bursts: 3, rays: 12 },
  house: { type: "cottage", parts: ["roof", "walls", "door", "windows", "chimney"], floors: 1, windows: 2 },
  stars: { type: "constellation", parts: ["stars", "depth"], stars: 24 },
  smoke: { type: "ribbon", parts: ["drift", "wisps"], wisps: 8 },
  waves: { type: "tidal", parts: ["crests", "foam", "depth"], crests: 3 },
  custom: { type: "illustration", parts: FORM_PARTS.custom, shapes: [] }
};

export const DEFAULT_PHASES = [
  { part: "stem-settle", start: 0.0, end: 0.2, easing: "ease-out" },
  { part: "leaves-unfurl", start: 0.1, end: 0.39, easing: "smooth" },
  { part: "outer-petals", start: 0.2, end: 0.49, easing: "ease-out" },
  { part: "middle-petals", start: 0.34, end: 0.64, easing: "smooth" },
  { part: "inner-petals", start: 0.5, end: 0.75, easing: "ease-out" },
  { part: "stamens", start: 0.66, end: 0.84, easing: "smooth" },
  { part: "ring-turn", start: 0.0, end: 1.0, easing: "smooth" },
  { part: "bursts", start: 0.0, end: 1.0, easing: "smooth" },
  { part: "window-light", start: 0.0, end: 1.0, easing: "smooth" },
  { part: "wave-flow", start: 0.0, end: 1.0, easing: "smooth" },
  { part: "smoke-drift", start: 0.0, end: 1.0, easing: "smooth" },
  { part: "heart-beat", start: 0.0, end: 1.0, easing: "smooth" }
];

function cleanText(value, fallback, limit) {
  return String(value || fallback).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) || fallback;
}

function finiteNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number.`);
  return number;
}

function integerClamp(value, fallback, minimum, maximum, name) {
  return Math.round(Math.max(minimum, Math.min(maximum, finiteNumber(value, fallback, name))));
}

function numberClamp(value, fallback, minimum, maximum, name) {
  return Math.max(minimum, Math.min(maximum, finiteNumber(value, fallback, name)));
}

function normalizeParts(value, fallback, motif) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) throw new Error("Scene form parts must be an array.");
  return [...new Set(value.filter((part) => typeof part === "string" && FORM_PARTS[motif].includes(part)))].slice(0, 7);
}

function normalizeShapes(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 36) throw new Error("Custom illustrations must contain at most 36 shapes.");
  return value.map((shape, index) => {
    if (!shape || typeof shape !== "object" || Array.isArray(shape)) throw new Error("Each custom shape must be a JSON object.");
    const allowed = new Set(["type", "x", "y", "width", "height", "points", "color", "glyph", "motion"]);
    if (Object.keys(shape).some((key) => !allowed.has(key))) throw new Error("A custom shape contains unsupported fields.");
    if (!SHAPE_TYPES.includes(shape.type)) throw new Error("A custom illustration uses an unsupported shape type.");
    if (shape.type === "polyline" && (!Array.isArray(shape.points) || shape.points.length < 2 || shape.points.length > 12)) {
      throw new Error("A custom polyline must have between 2 and 12 points.");
    }
    const points = shape.type === "polyline" ? shape.points.map((point) => {
      if (!Array.isArray(point) || point.length !== 2) throw new Error("Each polyline point must be an [x, y] pair.");
      return point.map((coordinate) => numberClamp(coordinate, 0.5, 0, 1, `shape ${index} point`));
    }) : undefined;
    const color = shape.color ?? "petal2";
    const glyph = shape.glyph ?? "*";
    const motion = shape.motion ?? "none";
    if (!SHAPE_COLORS.includes(color)) throw new Error("A custom shape uses an unsupported palette color.");
    if (!SHAPE_GLYPHS.includes(glyph)) throw new Error("A custom shape uses an unsupported terminal glyph.");
    if (!SHAPE_MOTIONS.includes(motion)) throw new Error("A custom shape uses an unsupported motion.");
    const result = {
      type: shape.type,
      x: numberClamp(shape.x, 0.5, 0, 1, `shape ${index} x`),
      y: numberClamp(shape.y, 0.5, 0, 1, `shape ${index} y`),
      width: numberClamp(shape.width, 0.12, 0.005, 0.8, `shape ${index} width`),
      height: numberClamp(shape.height, 0.12, 0.005, 0.8, `shape ${index} height`),
      color,
      glyph,
      motion
    };
    if (points) result.points = points;
    return result;
  });
}

function normalizeForm(value, motifs) {
  if (value === undefined) value = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scene form must be a JSON object.");
  const permitted = new Set(motifs);
  if (Object.keys(value).some((key) => !MOTIFS.includes(key) || !permitted.has(key))) {
    throw new Error("Scene form can describe only motifs included in this scene.");
  }
  const result = {};
  for (const motif of motifs) {
    const defaults = DEFAULT_FORMS[motif];
    const form = value[motif] ?? {};
    if (!form || typeof form !== "object" || Array.isArray(form)) throw new Error(`The ${motif} form must be a JSON object.`);
    const allowed = new Set(["type", "parts", ...Object.keys(defaults).filter((key) => key !== "type" && key !== "parts")]);
    if (Object.keys(form).some((key) => !allowed.has(key))) throw new Error(`The ${motif} form has unsupported fields.`);
    const type = form.type ?? defaults.type;
    if (type !== defaults.type) throw new Error(`The ${motif} form type is unsupported.`);
    result[motif] = { type: defaults.type, parts: normalizeParts(form.parts, defaults.parts, motif) };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (key === "type" || key === "parts") continue;
      if (key === "shapes") {
        result[motif][key] = normalizeShapes(form[key]);
        continue;
      }
      const maximum = key === "outerPetals" || key === "middlePetals" ? 14 : key === "innerPetals" ? 12 : key === "leaves" ? 4 : key === "stamens" ? 10 : key === "facets" ? 20 : key === "rings" ? 3 : key === "bursts" ? 4 : key === "rays" ? 20 : key === "floors" ? 2 : key === "windows" ? 6 : key === "stars" ? 48 : key === "wisps" ? 14 : 5;
      result[motif][key] = integerClamp(form[key], defaultValue, 1, maximum, `${motif}.${key}`);
    }
    if (motif === "custom" && result[motif].shapes.length === 0) {
      throw new Error("A custom illustration needs at least one safe shape.");
    }
  }
  return result;
}

function normalizeLayers(value) {
  if (value === undefined) return [...LAYERS];
  if (!Array.isArray(value)) throw new Error("Scene layers must be an array.");
  const layers = [...new Set(value.filter((layer) => LAYERS.includes(layer)))];
  return layers.length ? layers : [...LAYERS];
}

function normalizePhases(value) {
  if (value === undefined) return DEFAULT_PHASES.map((phase) => ({ ...phase }));
  if (!Array.isArray(value)) throw new Error("Scene motion phases must be an array.");
  const phases = [];
  for (const phase of value.slice(0, 12)) {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) throw new Error("Each motion phase must be a JSON object.");
    if (Object.keys(phase).some((key) => !["part", "start", "end", "easing"].includes(key))) throw new Error("A motion phase contains unsupported fields.");
    if (typeof phase.part !== "string" || !PARTS.includes(phase.part)) throw new Error("A motion phase uses an unsupported animation part.");
    const start = numberClamp(phase.start, 0, 0, 0.98, `${phase.part}.start`);
    const end = numberClamp(phase.end, 1, 0.02, 1, `${phase.part}.end`);
    const easing = phase.easing ?? "smooth";
    if (!EASINGS.includes(easing)) throw new Error(`${phase.part} uses an unsupported easing.`);
    phases.push({ part: phase.part, start: Math.min(start, end - 0.02), end, easing });
  }
  return phases.length ? phases : DEFAULT_PHASES.map((phase) => ({ ...phase }));
}

function inferredPalette(prompt, motifs) {
  if (/\b(ocean|sea|water|aqua|teal|turquoise)\b/i.test(prompt)) return "ocean";
  if (/\b(ice|icy|frost|frosty|blue|silver|white|moonlight)\b/i.test(prompt)) return "ice";
  if (/\b(green|lime|emerald|forest)\b/i.test(prompt)) return "phosphor";
  if (/\b(golden|gold|yellow|amber)\b/i.test(prompt)) return "amber";
  if (/\b(warm|sunset|orange|fire)\b/i.test(prompt)) return "ember";
  if (/\b(pink|rose|red|magenta)\b/i.test(prompt)) return "garden";
  if (/\b(purple|violet|space|galaxy|cosmic)\b/i.test(prompt)) return "cosmic";
  if (motifs.includes("fireworks")) return "festival";
  if (motifs.includes("flower")) return "garden";
  if (motifs.includes("waves")) return "ocean";
  if (motifs.includes("ring") || motifs.includes("stars") || motifs.includes("smoke")) return "cosmic";
  return "ember";
}

export function composeOffline(prompt, detail = "high") {
  const found = MOTIFS.filter((motif) => words[motif]?.test(prompt));
  const motifs = found.slice(0, 4);
  if (!motifs.length) {
    throw new Error("The offline composer does not know how to draw that subject yet. Choose an AI composer in Settings for custom subjects, or try a supported scene like a heart, rose, ring, fireworks, house, stars, smoke, or waves.");
  }
  const title = cleanText(prompt, "A little daydream", 48).replace(/[.!?].*$/, "").slice(0, 42) || "A little daydream";
  const sceneDescription = cleanText(prompt, "A little daydream", 120).replace(/^[A-Z]/, (letter) => letter.toLowerCase());
  const palette = inferredPalette(prompt, motifs);
  return validateScene({
    version: 2,
    title,
    description: `A looping offline scene of ${sceneDescription}, styled with ${palette} colors.`,
    duration: 8,
    fps: 24,
    loop: true,
    palette,
    motifs,
    layers: LAYERS,
    detail,
    form: {},
    phases: DEFAULT_PHASES
  });
}

export function validateScene(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The composer returned a scene that is not a JSON object.");
  if (value.version !== 1 && value.version !== 2) throw new Error("This scene plan uses an unsupported version.");
  const allowed = new Set(["version", "title", "description", "duration", "fps", "loop", "palette", "motifs"]);
  if (value.version === 2) ["layers", "detail", "form", "phases"].forEach((key) => allowed.add(key));
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("The scene plan includes unsupported fields. Try composing again.");
  if (typeof value.title !== "string" || value.title.length > 48 || !value.title.trim()) throw new Error("Scene title must be a non-empty string of at most 48 characters.");
  if (typeof value.description !== "string" || value.description.length > 180) throw new Error("Scene description must be a string of at most 180 characters.");
  if (value.loop !== true) throw new Error("Scenes must loop.");
  if (!PALETTES.includes(value.palette)) throw new Error("The scene selected an unsupported palette.");
  if (!Array.isArray(value.motifs) || value.motifs.length < 1 || value.motifs.length > 4 || value.motifs.some((motif) => !MOTIFS.includes(motif))) {
    throw new Error(`Choose between one and four supported motifs: ${MOTIFS.join(", ")}.`);
  }
  if (new Set(value.motifs).size !== value.motifs.length) throw new Error("Scene motifs must be unique.");
  const motifs = [...value.motifs];
  const detail = DETAILS.includes(value.detail) ? value.detail : "high";
  return {
    version: 2,
    title: cleanText(value.title, "Untitled scene", 48),
    description: cleanText(value.description, "A looping ASCII animation.", 180),
    duration: numberClamp(value.duration, 8, 4, 20, "Scene duration"),
    fps: integerClamp(value.fps, 24, 8, 30, "Scene frame rate"),
    loop: true,
    palette: value.palette,
    motifs,
    layers: normalizeLayers(value.layers),
    detail,
    form: normalizeForm(value.form, motifs),
    phases: normalizePhases(value.phases)
  };
}

export function parseSceneResponse(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The model did not return valid scene JSON. Try again or use the offline composer.");
  }
  return validateScene(parsed);
}

export const DETAIL_EXAMPLES = Object.freeze({
  low: composeOffline("A rose opening under a starry sky", "low"),
  medium: composeOffline("A rose opening under a starry sky", "medium"),
  high: composeOffline("A rose opening under a starry sky", "high"),
  extra: composeOffline("A rose opening under a starry sky", "extra"),
  max: composeOffline("A rose opening under a starry sky", "max")
});
