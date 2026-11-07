import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { composeOffline, DETAIL_EXAMPLES, parseSceneResponse, validateScene } from "../src/scene.js";
import { createFrameRenderer, colorizeFrame, createStandaloneHtml } from "../src/renderer.js";

test("offline composer recognizes multiple subjects and returns a version 2 loop", () => {
  const scene = composeOffline("A rose opening while stars twinkle above the waves");
  assert.deepEqual(scene.motifs, ["flower", "stars", "waves"]);
  assert.equal(scene.loop, true);
  assert.equal(scene.version, 2);
  assert.equal(scene.palette, "garden");
  assert.deepEqual(scene.layers, ["background", "subject", "foreground", "particles"]);
  assert.equal(scene.form.flower.type, "rose");
  assert.ok(scene.phases.some((phase) => phase.part === "outer-petals"));
});

test("offline composer recognizes a heart even when the prompt contains a common typo", () => {
  for (const prompt of ["A glowing heart beating gently", "A glowing hart under the stars"]) {
    const scene = composeOffline(prompt);
    assert.ok(scene.motifs.includes("heart"));
    assert.equal(scene.form.heart.type, "heart");
  }
});

test("offline composer explains when a requested subject needs an AI composer", () => {
  assert.throws(() => composeOffline("A dragon flying over a castle"), /Choose an AI composer in Settings/);
});

test("scene validator rejects executable fields but migrates older version-one scene data", () => {
  const scene = composeOffline("a ring turning in the night");
  assert.throws(() => validateScene({ ...scene, script: "alert(1)" }), /unsupported fields/);
  assert.throws(() => validateScene({ ...scene, motifs: ["constructor"] }), /supported motifs/);
  const legacy = validateScene({
    version: 1, title: "A legacy ring", description: "A ring in space.", duration: 8,
    fps: 24, loop: true, palette: "cosmic", motifs: ["ring"]
  });
  assert.equal(legacy.version, 2);
  assert.equal(legacy.detail, "high");
  assert.equal(legacy.form.ring.type, "faceted");
});

test("scene plans clamp numeric data and reject unsupported structures", () => {
  const scene = composeOffline("A rose opening");
  const clamped = validateScene({
    ...scene,
    duration: 100,
    fps: 100,
    detail: "medium",
    form: { flower: { outerPetals: 1000, leaves: 0 } },
    phases: [{ part: "outer-petals", start: -3, end: 3, easing: "ease-out" }]
  });
  assert.equal(clamped.duration, 20);
  assert.equal(clamped.fps, 30);
  assert.equal(clamped.form.flower.outerPetals, 14);
  assert.equal(clamped.form.flower.leaves, 1);
  assert.deepEqual(clamped.phases[0], { part: "outer-petals", start: 0, end: 1, easing: "ease-out" });
  assert.throws(() => validateScene({ ...scene, form: { flower: { script: "x" } } }), /unsupported fields/);
  assert.throws(() => validateScene({ ...scene, phases: [{ part: "javascript", start: 0, end: 1 }] }), /unsupported animation part/);
});

test("custom illustration plans accept bounded shapes and reject code or invalid glyphs", () => {
  const scene = composeOffline("A beating heart");
  const custom = validateScene({
    ...scene,
    motifs: ["custom"],
    form: {
      custom: {
        type: "illustration",
        parts: ["shapes"],
        shapes: [
          { type: "ellipse", x: 0.25, y: 0.2, width: 0.5, height: 0.6, color: "petal2", glyph: "#", motion: "pulse" },
          { type: "polyline", x: 0.2, y: 0.2, width: 0.5, height: 0.5, points: [[0, 0], [0.5, 1], [1, 0]], color: "light", glyph: "/" }
        ]
      }
    }
  });
  assert.equal(custom.form.custom.shapes.length, 2);
  assert.equal(custom.form.custom.shapes[0].motion, "pulse");
  assert.throws(() => validateScene({
    ...custom,
    form: { custom: { shapes: [{ type: "ellipse", x: 0.1, y: 0.1, width: 0.5, height: 0.5, glyph: "<script>" }] } }
  }), /unsupported terminal glyph/);
  assert.throws(() => validateScene({
    ...custom,
    form: { custom: { shapes: [{ type: "javascript", x: 0.1, y: 0.1 }] } }
  }), /unsupported shape type/);
  assert.throws(() => validateScene({ ...custom, form: { custom: { shapes: [] } } }), /at least one safe shape/);
});

test("offline composer chooses a vivid motif-matched palette", () => {
  assert.equal(composeOffline("A rose opening in the garden").palette, "garden");
  assert.equal(composeOffline("A silver ring turning in deep space").palette, "ice");
  assert.equal(composeOffline("Colorful fireworks blooming").palette, "festival");
  assert.equal(composeOffline("Blue ocean waves moving").palette, "ocean");
  assert.equal(composeOffline("A bright blue heart beating").palette, "ice");
  assert.equal(composeOffline("A golden house glowing at night").palette, "amber");
  assert.equal(composeOffline("An emerald heart pulsing").palette, "phosphor");
  assert.match(composeOffline("A vivid pink flower opening slowly").description, /looping offline scene of a vivid pink flower opening slowly/);
});

test("model response parser accepts JSON fences but only validated plans", () => {
  const scene = composeOffline("fireworks at night");
  assert.deepEqual(parseSceneResponse(`\`\`\`json\n${JSON.stringify(scene)}\n\`\`\``), scene);
  assert.throws(() => parseSceneResponse("not json"), /valid scene JSON/);
});

test("renderer fills responsive 100 by 32 and 120 by 40 terminal frames", () => {
  const scene = composeOffline("A rose opening under a starry sky");
  const render = createFrameRenderer();
  for (const [width, height] of [[100, 32], [120, 40]]) {
    const frame = render(scene, 5, width, height);
    const rows = frame.split("\n");
    assert.equal(rows.length, height);
    assert.ok(rows.some((row) => row.length >= Math.floor(width * 0.65)));
    assert.ok(rows.every((row) => row.length <= width));
  }
});

test("renderer supports fine-detail terminal grids beyond the standard preview size", () => {
  const scene = composeOffline("A rose opening under the stars", "max");
  const rows = createFrameRenderer()(scene, 5, 220, 56).split("\n");
  assert.equal(rows.length, 56);
  assert.ok(rows.some((row) => row.length >= 180));
  assert.ok(rows.every((row) => row.length <= 220));
  assert.ok(rows.some((row) => row.includes("@")));
});

test("detail examples make a visible, consistent density progression", () => {
  assert.equal(DETAIL_EXAMPLES.low.detail, "low");
  assert.equal(DETAIL_EXAMPLES.medium.detail, "medium");
  assert.equal(DETAIL_EXAMPLES.high.detail, "high");
  assert.equal(DETAIL_EXAMPLES.extra.detail, "extra");
  assert.equal(DETAIL_EXAMPLES.max.detail, "max");
  const render = createFrameRenderer();
  const inkCount = (scene) => [...render(scene, 5, 100, 32)].filter((character) => character !== " " && character !== "\n").length;
  assert.ok(inkCount(DETAIL_EXAMPLES.low) < inkCount(DETAIL_EXAMPLES.medium));
  assert.ok(inkCount(DETAIL_EXAMPLES.medium) < inkCount(DETAIL_EXAMPLES.high));
  assert.ok(inkCount(DETAIL_EXAMPLES.high) < inkCount(DETAIL_EXAMPLES.extra));
  assert.ok(inkCount(DETAIL_EXAMPLES.extra) < inkCount(DETAIL_EXAMPLES.max));
});

test("all built-in subjects respond to the shared extra and max detail levels", () => {
  const prompts = [
    "A rose opening under the stars",
    "A beating heart",
    "A ring turning in space",
    "Fireworks blooming at night",
    "Stars twinkling in the night",
    "Smoke drifting gently",
    "Waves flowing at sea",
    "A house glowing at night"
  ];
  const render = createFrameRenderer();
  for (const prompt of prompts) {
    const low = composeOffline(prompt, "low");
    const max = composeOffline(prompt, "max");
    assert.notEqual(render(low, 3.5, 100, 32), render(max, 3.5, 100, 32), `${prompt} should use the selected detail level`);
  }
  const custom = validateScene({
    ...composeOffline("A beating heart"),
    motifs: ["custom"],
    form: {
      custom: {
        shapes: [{ type: "ellipse", x: 0.3, y: 0.25, width: 0.4, height: 0.5, color: "petal2", glyph: "@" }]
      }
    }
  });
  assert.notEqual(
    render(validateScene({ ...custom, detail: "low" }), 3.5, 100, 32),
    render(validateScene({ ...custom, detail: "max" }), 3.5, 100, 32),
    "custom illustrations should use the selected detail level"
  );
});

test("rose animation visibly changes through its staged opening", () => {
  const scene = composeOffline("A rose opening under a starry sky");
  const render = createFrameRenderer();
  const closed = render(scene, 0, 100, 32);
  const opening = render(scene, 4, 100, 32);
  const open = render(scene, 7, 100, 32);
  assert.notEqual(closed, opening);
  assert.notEqual(opening, open);
  assert.ok(open.includes("@"));
  assert.ok(open.includes("*"));
  assert.ok(open.includes("|"));
});

test("heart renderer creates a large colorful pulsing silhouette", () => {
  const scene = composeOffline("A glowing heart beating gently among tiny stars");
  const render = createFrameRenderer();
  const frame = render(scene, 2, 100, 32);
  const lines = frame.split("\n");
  const heartRows = lines.filter((row) => row.includes("@") || row.includes("+") || row.includes("#"));
  assert.ok(scene.motifs.includes("heart"));
  assert.ok(heartRows.length >= 8);
  assert.ok(heartRows.some((row) => row.length > 50));
  assert.notEqual(render(scene, 0, 100, 32), render(scene, 2, 100, 32));
});

test("custom illustration primitives render without executing scene data", () => {
  const scene = validateScene({
    version: 2, title: "A paper kite", description: "A kite drifting across the sky.", duration: 8, fps: 24,
    loop: true, palette: "cosmic", motifs: ["custom"], detail: "high", layers: ["subject"],
    form: {
      custom: {
        type: "illustration", parts: ["shapes"], shapes: [
          { type: "triangle", x: 0.35, y: 0.2, width: 0.3, height: 0.35, color: "petal3", glyph: "#", motion: "sway" },
          { type: "polyline", x: 0.5, y: 0.5, width: 0.2, height: 0.4, points: [[0.5, 0], [0.5, 1], [0, 0.75], [0.5, 1], [1, 0.75]], color: "light", glyph: "/" }
        ]
      }
    }
  });
  const frame = createFrameRenderer()(scene, 1, 100, 32);
  assert.match(frame, /[#/]/);
  assert.doesNotMatch(frame, /script/);
});

test("colorized terminal output keeps the palette and does not render scene text as markup", () => {
  const scene = composeOffline("A flower opening in the garden");
  scene.title = "ROSE & STARS <dream>";
  const frame = createFrameRenderer()(scene, 1, 60, 18);
  const markup = colorizeFrame(scene, frame, 1, 60, 18);
  assert.match(markup, /style="color:#[0-9a-f]{6}"/i);
  assert.doesNotMatch(markup, /<dream>/);
  assert.doesNotMatch(markup, /ROSE & STARS/);
});

test("fireworks and smoke approach the loop seam without a position reset", () => {
  const scene = composeOffline("Smoke drifting beneath fireworks");
  const render = createFrameRenderer();
  const start = render(scene, 0, 60, 18);
  const nearEnd = render(scene, scene.duration - 0.01, 60, 18);
  const changedCells = [...start].reduce((count, character, index) => count + (character !== nearEnd[index] ? 1 : 0), 0);
  assert.ok(changedCells < 70, `loop seam changed ${changedCells} character positions`);
  assert.equal(render(scene, scene.duration, 60, 18), start);
});

test("flower and ring animations return to the exact first frame at the loop boundary", () => {
  const render = createFrameRenderer();
  for (const prompt of ["A rose opening under the stars", "A silver ring rotating in deep space"]) {
    const scene = composeOffline(prompt);
    assert.equal(render(scene, scene.duration, 100, 32), render(scene, 0, 100, 32));
  }
});

test("standalone export embeds the validated fixed renderer and never evaluates model code", () => {
  const scene = composeOffline("a ring rotating");
  const html = createStandaloneHtml(scene);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /function createFrameColorizer/);
  assert.match(html, /style="color:/);
  assert.match(html, /#030405/);
  assert.match(html, /CMDREAM STUDIO/);
  assert.ok(html.includes(JSON.stringify(scene).replace(/</g, "\\u003c")));
  assert.doesNotMatch(html, /eval\s*\(/);
});

test("standalone export runs its embedded renderer without page imports", () => {
  const scene = composeOffline("A rose opening under the stars");
  const html = createStandaloneHtml(scene);
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  const art = { clientWidth: 650, clientHeight: 420, innerHTML: "" };
  let nextFrame;
  runInNewContext(script, {
    document: { querySelector: () => art },
    getComputedStyle: () => ({ fontSize: "10px" }),
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { nextFrame = callback; }
  });
  assert.equal(typeof nextFrame, "function");
  nextFrame(1000);
  assert.match(art.innerHTML, /<span style="color:#[0-9a-f]{6}"/i);
  assert.match(art.innerHTML, /@/);
});
