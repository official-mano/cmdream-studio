import "./styles.css";
import { formatFileSize, loadProductInfo, findDownload } from "./releases.js";

const status = document.querySelector("#release-status");
const version = document.querySelector("#release-version");
const date = document.querySelector("#release-date");
const notes = document.querySelector("#release-notes");

function disableDownload(link, message) {
  link.textContent = "Download not configured";
  link.removeAttribute("href");
  link.setAttribute("aria-disabled", "true");
  link.closest(".release-card").querySelector("[data-file-info]").textContent = message;
}

try {
  const productInfo = loadProductInfo();
  version.textContent = `CMDream Studio ${productInfo.version}`;
  if (productInfo.releaseDate) {
    const releaseDate = new Date(`${productInfo.releaseDate}T00:00:00`);
    date.textContent = Number.isNaN(releaseDate.getTime())
      ? ""
      : `Release date ${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(releaseDate)}`;
  }
  notes.textContent = productInfo.releaseNotes.length
    ? productInfo.releaseNotes.map((note) => `• ${note}`).join("\n")
    : "No release notes are available for this version.";

  document.querySelectorAll("[data-asset]").forEach((card) => {
    const download = findDownload(productInfo, card.dataset.asset);
    const link = card.querySelector("[data-download]");
    if (!download || !download.url) {
      disableDownload(link, download ? "No installer has been published for this package yet." : "This package is not in the current product catalog.");
      return;
    }
    link.href = download.url;
    link.removeAttribute("aria-disabled");
    link.textContent = `Download ${download.package}`;
    card.querySelector("[data-file-info]").textContent =
      `${download.fileName} · ${formatFileSize(download.sizeBytes)}${download.sha256 ? ` · SHA-256 ${download.sha256}` : ""}`;
  });
  status.textContent = "Version and availability are read from CMDream Studio’s product catalog. Downloads open the configured file host.";
} catch (error) {
  version.textContent = "Product information unavailable";
  date.textContent = "";
  notes.textContent = "Product details could not be loaded.";
  status.textContent = `Unable to read the product catalog: ${error.message}`;
  document.querySelectorAll("[data-download]").forEach((link) => disableDownload(link, "Product information is unavailable."));
}
