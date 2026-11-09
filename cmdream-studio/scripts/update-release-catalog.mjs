import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalogDownloads } from "./download-manifest.js";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadataPath = path.join(appDirectory, "src", "product-info.json");
const releaseDirectory = path.join(appDirectory, "release");
const packageMetadata = JSON.parse(await readFile(path.join(appDirectory, "package.json"), "utf8"));
const version = packageMetadata.version;
const expectedDownloads = [
  { id: "windows-x64-installer", fileName: `CMDream-Studio-${version}-Setup-x64.exe`, platform: "Windows", architecture: "x64", package: "Installer" },
  { id: "windows-x64-portable", fileName: `CMDream-Studio-${version}-Portable-x64.exe`, platform: "Windows", architecture: "x64", package: "Portable app" },
  { id: "windows-arm64-installer", fileName: `CMDream-Studio-${version}-Setup-arm64.exe`, platform: "Windows", architecture: "ARM64", package: "Installer" },
  { id: "windows-arm64-portable", fileName: `CMDream-Studio-${version}-Portable-arm64.exe`, platform: "Windows", architecture: "ARM64", package: "Portable app" },
  { id: "linux-x64-appimage", fileName: `CMDream-Studio-${version}-x64.AppImage`, platform: "Linux", architecture: "x86_64", package: "AppImage" },
  { id: "linux-x64-deb", fileName: `CMDream-Studio-${version}-x64.deb`, platform: "Linux", architecture: "x86_64", package: "Debian package" },
  { id: "macos-x64-dmg", fileName: `CMDream-Studio-${version}-x64.dmg`, platform: "macOS", architecture: "Intel", package: "Disk image" },
  { id: "macos-arm64-dmg", fileName: `CMDream-Studio-${version}-arm64.dmg`, platform: "macOS", architecture: "Apple silicon", package: "Disk image" },
  { id: "macos-x64-zip", fileName: `CMDream-Studio-${version}-x64.zip`, platform: "macOS", architecture: "Intel", package: "ZIP archive" },
  { id: "macos-arm64-zip", fileName: `CMDream-Studio-${version}-arm64.zip`, platform: "macOS", architecture: "Apple silicon", package: "ZIP archive" }
];

async function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const assets = [];
for (const item of expectedDownloads) {
  const filePath = path.join(releaseDirectory, item.fileName);
  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      process.stdout.write(`Skipping ${item.fileName}: artifact not found.\n`);
      continue;
    }
    throw error;
  }
  if (!fileInfo.isFile() || fileInfo.size < 1024) throw new Error(`${item.fileName} is not a valid release file.`);
  assets.push({ ...item, filePath, sizeBytes: fileInfo.size, sha256: await checksumFile(filePath) });
}
if (process.env.REQUIRE_ALL_DOWNLOADS === "1" && assets.length !== expectedDownloads.length) {
  const uploaded = new Set(assets.map((asset) => asset.fileName));
  const missing = expectedDownloads.filter((asset) => !uploaded.has(asset.fileName)).map((asset) => asset.fileName);
  throw new Error(`Refusing to publish an incomplete release. Missing build artifacts: ${missing.join(", ")}`);
}

if (!assets.length) {
  throw new Error(`No release files were found in ${releaseDirectory}. Build release packages before updating the catalog.`);
}

const productInfo = JSON.parse(await readFile(metadataPath, "utf8"));
productInfo.version = version;
productInfo.releaseDate = new Date().toISOString().slice(0, 10);
productInfo.downloads = createCatalogDownloads(expectedDownloads, assets, version);
const temporaryPath = `${metadataPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(productInfo, null, 2)}\n`, { flag: "w" });
await rename(temporaryPath, metadataPath);

console.log(`Updated the download catalog for CMDream Studio ${version}.`);
console.log(`${assets.length} release assets have checksums and GitHub Release URLs.`);
console.log("The release workflow uploads these files to GitHub Releases and deploys this catalog.");
