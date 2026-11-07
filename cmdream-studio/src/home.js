import "./styles.css";
import { composeOffline } from "./scene.js";
import { renderFrame, colorizeFrame } from "./renderer.js";

const examples = {
  flower: "A rose slowly opening in a garden",
  ring: "A ring turning in the stars",
  waves: "Soft ocean waves flowing beneath the sky",
  fireworks: "Colorful fireworks blooming in the night"
};
const starts = performance.now();

document.querySelectorAll(".ascii-preview").forEach((preview) => {
  const scene = composeOffline(examples[preview.dataset.scene] || examples.stars);
  const width = preview.closest(".showcase-screen") ? 50 : 64;
  const height = preview.closest(".showcase-screen") ? 15 : 19;
  function animate(now) {
    const elapsed = (now - starts) / 1000;
    preview.innerHTML = colorizeFrame(scene, renderFrame(scene, elapsed, width, height), elapsed, width, height);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});

document.querySelectorAll("[data-release-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const url = new URL(link.href);
    if (url.pathname.includes("YOUR-GITHUB-USERNAME")) {
      event.preventDefault();
      window.alert("Add your GitHub username in index.html to activate the latest-release download link.");
    }
  });
});
