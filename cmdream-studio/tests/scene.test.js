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

test("offline composer chooses a vivid motif-matched palette", () => {
  assert.equal(composeOffline("A rose opening in the garden").palette, "garden");
  assert.equal(composeOffline("A silver ring turning in deep space").palette, "cosmic");
  assert.equal(composeOffline("Colorful fireworks blooming").palette, "festival");
  assert.equal(composeOffline("Blue ocean waves moving").palette, "ocean");
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

test("detail examples make a visible, consistent density progression", () => {
  assert.equal(DETAIL_EXAMPLES.low.detail, "low");
  assert.equal(DETAIL_EXAMPLES.medium.detail, "medium");
  assert.equal(DETAIL_EXAMPLES.high.detail, "high");
  const render = createFrameRenderer();
  const inkCount = (scene) => [...render(scene, 5, 100, 32)].filter((character) => character !== " " && character !== "\n").length;
  assert.ok(inkCount(DETAIL_EXAMPLES.low) < inkCount(DETAIL_EXAMPLES.medium));
  assert.ok(inkCount(DETAIL_EXAMPLES.medium) < inkCount(DETAIL_EXAMPLES.high));
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
