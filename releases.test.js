import test from "node:test";
import assert from "node:assert/strict";
import { formatFileSize, findDownload, loadProductInfo } from "./releases.js";

test("product catalog contains versioned platform entries", () => {
  const product = loadProductInfo();
  assert.equal(product.version, "1.2.0");
  assert.deepEqual(product.downloads.map((download) => download.id), [
    "windows-x64-installer",
    "windows-x64-portable",
    "windows-arm64-installer",
    "windows-arm64-portable",
    "linux-x64-appimage"
  ]);
  assert.equal(findDownload(product, "windows-x64-installer").fileName, "CMDream-Studio-1.2.0-Setup-x64.exe");
  assert.equal(findDownload(product, "not-a-package"), undefined);
});

test("catalog accepts a configured HTTPS storage URL and rejects GitHub or unsafe URLs", () => {
  const product = loadProductInfo();
  const download = product.downloads[0];
  const configured = { ...product, downloads: [{ ...download, url: "https://downloads.example.com/studio.exe" }] };
  assert.equal(loadProductInfo(configured).downloads[0].url, "https://downloads.example.com/studio.exe");

  for (const url of [
    "http://downloads.example.com/studio.exe",
    "https://github.com/official-mano/cmdream-studio/releases/download/v1.2.0/studio.exe",
    "https://user:password@downloads.example.com/studio.exe",
    "javascript:alert(1)"
  ]) {
    const invalid = { ...product, downloads: [{ ...download, url }] };
    assert.throws(() => loadProductInfo(invalid), /unsupported URL/);
  }
});

test("catalog rejects duplicate IDs and invalid metadata", () => {
  const product = loadProductInfo();
  const entry = product.downloads[0];
  assert.throws(() => loadProductInfo({ ...product, downloads: [entry, entry] }), /entry is invalid/);
  assert.throws(() => loadProductInfo({ ...product, downloads: [null] }), /entry is invalid/);
  assert.throws(() => loadProductInfo({ ...product, releaseNotes: [42] }), /invalid format/);
  assert.throws(() => loadProductInfo({ ...product, version: "latest" }), /invalid format/);
  assert.throws(() => loadProductInfo({ ...product, downloads: [{ ...entry, sizeBytes: -1 }] }), /entry is invalid/);
});

test("file sizes are readable and invalid sizes are explicit", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(1), "1 B");
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(1_500_000), "1.4 MB");
  assert.equal(formatFileSize(-1), "Size unavailable");
});
