import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogDownloads } from "../scripts/download-manifest.js";

const expectedDownloads = [
  { id: "windows-x64-installer", fileName: "CMDream-Studio-1.1.0-Setup-x64.exe" },
  { id: "linux-x64-appimage", fileName: "CMDream-Studio-1.1.0-x64.AppImage" }
];

test("publisher marks present packages available and leaves missing platforms disabled", () => {
  const [windows] = expectedDownloads;
  const results = createCatalogDownloads(expectedDownloads, [{
    ...windows,
    sizeBytes: 1234,
    sha256: "a".repeat(64)
  }], "1.1.0", "https://downloads.example.com");

  assert.equal(results[0].url, "https://downloads.example.com/releases/v1.1.0/CMDream-Studio-1.1.0-Setup-x64.exe");
  assert.equal(results[0].sizeBytes, 1234);
  assert.equal(results[0].sha256, "a".repeat(64));
  assert.equal(results[1].url, "");
  assert.equal(results[1].sizeBytes, null);
  assert.equal(results[1].sha256, "");
});

test("publisher encodes release asset filenames in public URLs", () => {
  const results = createCatalogDownloads([{
    id: "windows-x64-installer",
    fileName: "CMDream Studio setup.exe"
  }], [{
    id: "windows-x64-installer",
    fileName: "CMDream Studio setup.exe",
    sizeBytes: 1234,
    sha256: "b".repeat(64)
  }], "1.1.0", "https://downloads.example.com");
  assert.equal(results[0].url, "https://downloads.example.com/releases/v1.1.0/CMDream%20Studio%20setup.exe");
});
