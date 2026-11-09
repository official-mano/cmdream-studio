import catalog from "./product-info.json" with { type: "json" };

export function loadProductInfo(data = catalog) {
  if (!data || data.schemaVersion !== 1 || typeof data.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/i.test(data.version) ||
      !Array.isArray(data.releaseNotes) || data.releaseNotes.some((note) => typeof note !== "string" || note.length > 2000) ||
      !Array.isArray(data.downloads)) {
    throw new Error("The product information file has an invalid format.");
  }
  const ids = new Set();
  if (!data.downloads.every((item) => {
    if (!item || typeof item !== "object" || ids.has(item.id)) return false;
    ids.add(item.id);
    return (
      typeof item.id === "string" && item.id.length > 0 &&
      typeof item.platform === "string" && item.platform.length > 0 &&
      typeof item.architecture === "string" && item.architecture.length > 0 &&
      typeof item.package === "string" && item.package.length > 0 &&
      typeof item.fileName === "string" && item.fileName.length > 0 &&
      (item.url === "" || isSafeDownloadUrl(item.url, data.version, item.fileName)) &&
      (item.sizeBytes === null || (Number.isSafeInteger(item.sizeBytes) && item.sizeBytes >= 0)) &&
      (typeof item.sha256 === "string" && (item.sha256 === "" || /^[a-f\d]{64}$/i.test(item.sha256)))
    );
  })) {
    throw new Error("A product download entry is invalid or uses an unsupported URL.");
  }
  return data;
}

function isSafeDownloadUrl(value, version, fileName) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hostname === "github.com" &&
      url.pathname === `/official-mano/cmdream-studio/releases/download/v${version}/${encodeURIComponent(fileName)}` &&
      url.search === "" &&
      url.hash === "";
  } catch {
    return false;
  }
}

export function findDownload(data, id) {
  return loadProductInfo(data).downloads.find((item) => item.id === id);
}

export function formatFileSize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return "Size unavailable";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
