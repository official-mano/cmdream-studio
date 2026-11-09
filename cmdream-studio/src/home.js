import "./styles.css";
import { composeOffline } from "./scene.js";
import { renderFrame } from "./renderer.js";
import { loadProductInfo, findDownload } from "./releases.js";

const releaseStatus = document.querySelector("#home-release-status");
let productInfo = null;
try {
  productInfo = loadProductInfo();
  for (const link of document.querySelectorAll("[data-release-kind]")) {
    const download = findDownload(productInfo, link.dataset.releaseKind);
    if (download?.url) {
      link.href = download.url;
      link.textContent = `${download.platform} ${download.architecture} · ${download.package} ↗`;
    } else {
      link.href = "./downloads.html";
      link.textContent = "Visit the download center →";
    }
  }
  releaseStatus.textContent = `CMDream Studio ${productInfo.version} · ${productInfo.downloads.filter((item) => item.url).length} downloads currently available.`;
} catch (error) {
  releaseStatus.textContent = `Product information is unavailable: ${error.message}`;
  document.querySelectorAll("[data-release-kind]").forEach((link) => {
    link.href = "./downloads.html";
    link.textContent = "Visit the download center →";
  });
}

const previewCards = [...document.querySelectorAll("[data-scene]")].map((preview) => ({
  preview,
  scene: composeOffline(preview.dataset.scene === "flower"
    ? "A rose opening under a starry sky"
    : preview.dataset.scene, "high")
}));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const previewStart = performance.now();

function renderPreviews(now) {
  for (const { preview, scene } of previewCards) {
    const fontSize = Number.parseFloat(getComputedStyle(preview).fontSize) || 8;
    const width = Math.max(24, Math.min(90, Math.floor(preview.parentElement.clientWidth / (fontSize * 0.62))));
    const height = Math.max(12, Math.min(30, Math.floor(preview.parentElement.clientHeight / (fontSize * 1.35))));
    const seconds = reducedMotion ? 0.45 : (now - previewStart) / 1000;
    preview.textContent = renderFrame(scene, seconds, width, height);
  }
  if (!reducedMotion) requestAnimationFrame(renderPreviews);
}

renderPreviews(previewStart);
