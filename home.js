import "./styles.css";
import { composeOffline } from "./scene.js";
import { colorizeFrame } from "./renderer.js";
import { loadProductInfo } from "./releases.js";

const releaseStatus = document.querySelector("#home-release-status");
let productInfo = null;
try {
  productInfo = loadProductInfo();
  const availableDownloads = productInfo.downloads.filter((item) => item.url).length;
  releaseStatus.textContent = availableDownloads
    ? `Version ${productInfo.version} · ${availableDownloads} desktop package${availableDownloads === 1 ? "" : "s"} available.`
    : `Version ${productInfo.version} · Desktop packages are not published yet.`;
} catch (error) {
  releaseStatus.textContent = `Product information is unavailable: ${error.message}`;
}

const examples = {
  flower: "A vivid pink rose opening beneath a starlit sky",
  heart: "A glowing red heart beating gently in the dark",
  ring: "A silver ring rotating through blue starlight",
  fireworks: "Colorful fireworks blooming above a quiet night",
  house: "A warm golden house glowing beneath the stars",
  waves: "Moonlit blue waves rolling beneath a quiet sky"
};
const starts = performance.now();
const previews = [...document.querySelectorAll(".ascii-preview")].map((preview) => {
  const scene = composeOffline(examples[preview.dataset.scene] || examples.flower, "max");
  return { preview, scene, width: 64, height: 24, lastFrame: 0 };
});

function resizePreview({ preview, container }) {
  const bounds = container.getBoundingClientRect();
  const style = getComputedStyle(preview);
  const fontSize = Number.parseFloat(style.fontSize) || 8;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.2;
  return {
    columns: Math.max(48, Math.min(180, Math.floor((bounds.width - 28) / (fontSize * 0.61)))),
    rows: Math.max(16, Math.min(46, Math.floor((bounds.height - 34) / lineHeight)))
  };
}

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const preview = entry.target.querySelector(".ascii-preview");
    const item = previews.find((candidate) => candidate.preview === preview);
    if (!item) continue;
    const { columns, rows } = resizePreview({ preview, container: entry.target });
    item.width = columns;
    item.height = rows;
  }
});
previews.forEach(({ preview }) => resizeObserver.observe(preview.parentElement));

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function animate(now) {
  for (const item of previews) {
    if (!reducedMotion && now - item.lastFrame < 1000 / 24) continue;
    item.lastFrame = now;
    const elapsed = reducedMotion ? 5 : (now - starts) / 1000;
    item.preview.innerHTML = colorizeFrame(item.scene, "", elapsed, item.width, item.height);
  }
  if (!reducedMotion) requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
