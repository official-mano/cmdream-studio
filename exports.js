import { createStandaloneHtml, renderCells, renderFrame } from "./renderer.js";

const encoder = new TextEncoder();
const imageWidth = 1280;
const imageHeight = 720;
const columns = 120;
const rows = 36;

function monochromeColor(value) {
  const match = /^#([\da-f]{6})$/i.exec(value || "");
  if (!match) return "#d8d8d8";
  const color = match[1];
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const level = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
  return `#${level.toString(16).padStart(2, "0").repeat(3)}`;
}

function drawExportCanvas(canvas, scene, seconds) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot create an image preview.");

  context.fillStyle = "#030303";
  context.fillRect(0, 0, imageWidth, imageHeight);
  const fontSize = 15;
  const cellWidth = fontSize * 0.61;
  const lineHeight = fontSize * 1.2;
  const gridWidth = columns * cellWidth;
  const gridHeight = rows * lineHeight;
  const startX = (imageWidth - gridWidth) / 2;
  const startY = (imageHeight - gridHeight) / 2;
  context.font = `${fontSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  context.textBaseline = "top";

  const frame = renderCells(scene, seconds, columns, rows);
  frame.forEach((line, row) => {
    line.forEach((cell, column) => {
      if (cell.glyph === " ") return;
      context.fillStyle = monochromeColor(cell.color);
      context.fillText(cell.glyph, startX + column * cellWidth, startY + row * lineHeight);
    });
  });
}

export function createExportCanvas(scene, seconds = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  drawExportCanvas(canvas, scene, seconds);
  return canvas;
}

export function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not create a PNG image."));
    }, "image/png");
  });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const dosTimestamp = () => {
  const date = new Date();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
};

async function zipStoredFiles(entries) {
  const localParts = [];
  const directoryParts = [];
  let localOffset = 0;
  const { time, day } = dosTimestamp();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === "string"
      ? encoder.encode(entry.data)
      : entry.data instanceof Blob
        ? new Uint8Array(await entry.data.arrayBuffer())
        : entry.data;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const directory = new Uint8Array(46 + name.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint16(8, 0x0800, true);
    directoryView.setUint16(10, 0, true);
    directoryView.setUint16(12, time, true);
    directoryView.setUint16(14, day, true);
    directoryView.setUint32(16, checksum, true);
    directoryView.setUint32(20, data.length, true);
    directoryView.setUint32(24, data.length, true);
    directoryView.setUint16(28, name.length, true);
    directoryView.setUint16(30, 0, true);
    directoryView.setUint16(32, 0, true);
    directoryView.setUint16(34, 0, true);
    directoryView.setUint16(36, 0, true);
    directoryView.setUint32(38, 0, true);
    directoryView.setUint32(42, localOffset, true);
    directory.set(name, 46);
    directoryParts.push(directory);
    localOffset += local.length;
  }

  const directorySize = directoryParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return new Blob([...localParts, ...directoryParts, end], { type: "application/zip" });
}

export async function createScenePack(scene, seconds = 0, preparedPreview = null) {
  const title = scene.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 64) || "CMDream scene";
  const preview = preparedPreview || await canvasToPng(createExportCanvas(scene, seconds));
  const ascii = renderFrame(scene, seconds, columns, rows);
  const files = [
    { name: "scene.json", data: `${JSON.stringify(scene, null, 2)}\n` },
    { name: "animation.html", data: createStandaloneHtml(scene) },
    { name: "preview.png", data: preview },
    { name: "preview.txt", data: `${ascii}\n` },
    { name: "README.txt", data: `${title}\n\nCreated with CMDream Studio.\n\nscene.json is the editable scene plan. Open animation.html in a modern browser to play the self-contained loop. preview.png and preview.txt are still images of the current frame.\n` }
  ];
  return zipStoredFiles(files);
}

export function supportedVideoType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function" ||
      typeof document.createElement("canvas").captureStream !== "function") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function recordSceneVideo(scene, onProgress = () => {}) {
  const canvas = createExportCanvas(scene, 0);
  const mimeType = supportedVideoType();
  if (!mimeType) throw new Error("This browser cannot record a video file. Use the PNG or scene pack export instead.");

  const fps = 12;
  const totalFrames = Math.max(1, Math.ceil(scene.duration * fps));
  const stream = canvas.captureStream(fps);
  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_600_000 });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(`This browser could not start video recording: ${error.message}`);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let frame = 0;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = (event) => {
      stream.getTracks().forEach((track) => track.stop());
      reject(event.error || new Error("Video recording failed."));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const type = recorder.mimeType || mimeType;
      resolve({ blob: new Blob(chunks, { type }), extension: type.includes("mp4") ? "mp4" : "webm" });
    };
    recorder.start();

    const drawNextFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }
      drawExportCanvas(canvas, scene, scene.duration * frame / totalFrames);
      frame += 1;
      onProgress(frame / totalFrames);
      setTimeout(drawNextFrame, 1000 / fps);
    };
    drawNextFrame();
  });
}
