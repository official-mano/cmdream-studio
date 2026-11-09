import "./styles.css";
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
