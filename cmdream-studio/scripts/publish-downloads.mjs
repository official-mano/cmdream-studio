import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

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
  { id: "linux-x64-appimage", fileName: `CMDream-Studio-${version}-x64.AppImage`, platform: "Linux", architecture: "x86_64", package: "AppImage" }
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in your local shell before publishing.`);
  return value;
}

function createPublicBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("R2_PUBLIC_BASE_URL must be the HTTPS custom domain attached to your public R2 bucket.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.hostname === "github.com" || url.hostname.endsWith(".github.com")) {
    throw new Error("R2_PUBLIC_BASE_URL must be a public HTTPS download domain, not GitHub or a URL containing credentials.");
  }
  return url.toString().replace(/\/+$/, "");
}

async function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const accountId = requiredEnvironment("R2_ACCOUNT_ID");
const accessKeyId = requiredEnvironment("R2_ACCESS_KEY_ID");
const secretAccessKey = requiredEnvironment("R2_SECRET_ACCESS_KEY");
const bucketName = requiredEnvironment("R2_BUCKET_NAME");
const publicBaseUrl = createPublicBaseUrl(requiredEnvironment("R2_PUBLIC_BASE_URL"));
if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(bucketName)) {
  throw new Error("R2_BUCKET_NAME is not a valid bucket name.");
}

const assets = [];
for (const item of expectedDownloads) {
  const filePath = path.join(releaseDirectory, item.fileName);
  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Missing ${item.fileName}. Build all Windows architectures and Linux x64, then place the release artifacts in ${releaseDirectory}.`);
    }
    throw error;
  }
  if (!fileInfo.isFile() || fileInfo.size < 1024) throw new Error(`${item.fileName} is not a valid release file.`);
  assets.push({ ...item, filePath, sizeBytes: fileInfo.size, sha256: await checksumFile(filePath) });
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
});

try {
  for (const asset of assets) {
    const objectKey = `releases/v${version}/${asset.fileName}`;
    const upload = new Upload({
      client,
      params: {
        Bucket: bucketName,
        Key: objectKey,
        Body: createReadStream(asset.filePath),
        ContentLength: asset.sizeBytes,
        ContentType: asset.fileName.endsWith(".exe") ? "application/vnd.microsoft.portable-executable" : "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable"
      },
      queueSize: 2,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false
    });
    upload.on("httpUploadProgress", (progress) => {
      if (progress.loaded && progress.total) {
        process.stdout.write(`\rUploading ${asset.fileName}: ${Math.floor(progress.loaded / progress.total * 100)}%`);
      }
    });
    await upload.done();
    process.stdout.write(`\rUploaded ${asset.fileName} (${asset.sizeBytes} bytes)\n`);
  }

  const productInfo = JSON.parse(await readFile(metadataPath, "utf8"));
  productInfo.version = version;
  productInfo.releaseDate = new Date().toISOString().slice(0, 10);
  productInfo.downloads = assets.map((asset) => ({
    id: asset.id,
    platform: asset.platform,
    architecture: asset.architecture,
    package: asset.package,
    fileName: asset.fileName,
    url: `${publicBaseUrl}/releases/v${version}/${asset.fileName.split("/").map(encodeURIComponent).join("/")}`,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256
  }));
  const temporaryPath = `${metadataPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(productInfo, null, 2)}\n`, { flag: "w" });
  await rename(temporaryPath, metadataPath);
} finally {
  await client.destroy();
}

console.log(`\nPublished ${assets.length} downloads to Cloudflare R2.`);
console.log("Commit and deploy src/product-info.json to update the website download center.");
