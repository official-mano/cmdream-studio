function createSceneRenderer() {
  const palettes = {
    garden: { petals: ["#a63d74", "#e76ca0", "#ffadd0", "#ffd6e5"], leaf: "#78d997", vein: "#b3f0aa", light: "#ffe7a0", sky: ["#82c8e8", "#aa9cff"], water: "#71d9ff", house: "#e5aa80" },
    cosmic: { petals: ["#754dad", "#a57adf", "#d0a6ff", "#e4d7ff"], leaf: "#78d7a9", vein: "#b3eed3", light: "#ffebaa", sky: ["#82c8ff", "#bb9cff"], water: "#7ce6ff", house: "#b79bda" },
    festival: { petals: ["#a83f69", "#eb668b", "#ffad77", "#ffe29a"], leaf: "#85d89a", vein: "#c5f0a1", light: "#fff2a1", sky: ["#83dfff", "#ffa5dc"], water: "#73e8e0", house: "#f0c77c" },
    ocean: { petals: ["#3d8290", "#5fc2c9", "#93e6e5", "#c5f3ee"], leaf: "#62d1ae", vein: "#abf0cd", light: "#f3f2b1", sky: ["#79d7ff", "#93b7ff"], water: "#55d9f4", house: "#85cbd0" },
    ember: { petals: ["#963f3b", "#dc654d", "#ff9c6e", "#ffd082"], leaf: "#9bc875", vein: "#d7e89b", light: "#fff0a0", sky: ["#ffc98d", "#ff9e7b"], water: "#ffc27d", house: "#e99a61" },
    phosphor: { petals: ["#527c43", "#82bd69", "#b6e895", "#e1f3a5"], leaf: "#6bd28a", vein: "#c5f2a0", light: "#e5f5a0", sky: ["#82e8cd", "#c2ee9b"], water: "#72e0d0", house: "#c9d88b" },
    amber: { petals: ["#9a552f", "#dd8c45", "#ffc778", "#ffe29a"], leaf: "#9dca78", vein: "#d6ed9c", light: "#fff0a0", sky: ["#ffdb98", "#ffc37d"], water: "#87daca", house: "#eab665" },
    ice: { petals: ["#5d6eaa", "#8497dc", "#b2c7ff", "#e0e6ff"], leaf: "#6cc6b3", vein: "#a9e9d8", light: "#e4f7ff", sky: ["#8ce9ff", "#c5b6ff"], water: "#76e5ff", house: "#a8c9e8" }
  };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeOut = (value) => 1 - (1 - clamp(value, 0, 1)) ** 2;
  const fract = (value) => value - Math.floor(value);
  const hash = (x, y, seed = 0) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return function renderScene(scene, seconds, width = 100, height = 32, asHtml = false) {
    const w = Math.round(clamp(width, 24, 240));
    const h = Math.round(clamp(height, 12, 60));
    const time = ((seconds % scene.duration) + scene.duration) % scene.duration / scene.duration;
    const motifSet = new Set(scene.motifs);
    const palette = palettes[scene.palette] || palettes.garden;
    const density = scene.detail === "low" ? 0.55 : scene.detail === "medium" ? 0.8 : 1;
    const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ glyph: " ", color: null, depth: -1 })));
    const enabled = (name) => scene.layers?.includes(name) ?? true;
    const put = (x, y, glyph, color, depth = 1) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || x >= w || y < 0 || y >= h || !glyph) return;
      const cell = rows[y][x];
      if (depth >= cell.depth) rows[y][x] = { glyph, color, depth };
    };
    const line = (x1, y1, x2, y2, glyph, color, depth = 2) => {
      const count = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 1.4));
      for (let i = 0; i <= count; i += 1) {
        const ratio = i / count;
        put(x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, glyph, color, depth);
      }
    };
    const bezier = (a, b, c, d, ratio) => {
      const inverse = 1 - ratio;
      return inverse ** 3 * a + 3 * inverse ** 2 * ratio * b + 3 * inverse * ratio ** 2 * c + ratio ** 3 * d;
    };
    const curve = (x1, y1, x2, y2, bend, glyph, color, depth = 2) => {
      let previous = [x1, y1];
      for (let i = 1; i <= Math.max(10, Math.round(h * 1.1)); i += 1) {
        const t = i / Math.max(10, Math.round(h * 1.1));
        const x = bezier(x1, x1 + bend, x2 - bend * 0.45, x2, t);
        const y = bezier(y1, y1 - Math.abs(y2 - y1) * 0.2, y2 + Math.abs(y2 - y1) * 0.2, y2, t);
        line(previous[0], previous[1], x, y, glyph, color, depth);
        previous = [x, y];
      }
    };
    const phase = (part, fallbackStart, fallbackEnd, easing = "smooth") => {
      const config = scene.phases?.find((item) => item.part === part);
      const start = config?.start ?? fallbackStart;
      const end = config?.end ?? fallbackEnd;
      const progress = clamp((time - start) / Math.max(0.02, end - start), 0, 1);
      return (config?.easing ?? easing) === "ease-in" ? progress * progress : (config?.easing ?? easing) === "ease-out" ? easeOut(progress) : smooth(progress);
    };
    const close = 1 - smooth((time - 0.9) / 0.1);
    const centerX = w * 0.5;
    const groundY = h - 3;
    const wide = w / 100;
    const tall = h / 32;

    if (enabled("background") && (motifSet.has("stars") || motifSet.has("flower") || motifSet.has("house") || motifSet.has("fireworks") || motifSet.has("ring"))) {
      const count = Math.round(clamp((scene.form?.stars?.stars ?? w * h / 100) * density, 10, 78));
      for (let i = 0; i < count; i += 1) {
        const depth = scene.form?.stars?.parts?.includes("depth") === false ? 0 : i % 3;
        const x = fract(hash(i, depth, 2) + Math.sin(time * Math.PI * 2 + i * 0.71) * (0.0015 + depth * 0.002)) * w;
        const y = 1 + hash(i, depth, 5) * Math.max(2, h * 0.7);
        const glimmer = Math.sin(time * Math.PI * 2 + i * 2.3 + depth) * 0.5 + 0.5;
        if (glimmer > 0.79) {
          put(x, y, i % 11 === 0 ? "+" : ".", palette.light, 0);
          if (density > 0.75 && i % 7 === 0) put(x + 1, y, "·", palette.sky[i % 2], 0);
        } else if (glimmer < 0.13) {
          put(x, y, "·", palette.sky[depth % palette.sky.length], 0);
        } else {
          put(x, y, depth === 2 && i % 5 === 0 ? "*" : ".", palette.sky[(i + depth) % palette.sky.length], 0);
        }
      }
    }

    if (enabled("background") && (motifSet.has("house") || motifSet.has("flower") || motifSet.has("waves"))) {
      const horizon = motifSet.has("waves") ? h - Math.max(6, Math.round(h * 0.25)) : groundY;
      const count = Math.round(w * (scene.detail === "low" ? 0.025 : scene.detail === "medium" ? 0.045 : 0.065));
      for (let i = 0; i < count; i += 1) {
        const x = hash(i, 3, 11) * w;
        const y = horizon + Math.round(hash(i, 5, 13) * 2);
        put(x, y, hash(i, 8, 17) > 0.55 ? "." : "'", palette.leaf, 0);
      }
    }

    if (motifSet.has("waves") && enabled("subject")) {
      const waveParts = scene.form?.waves?.parts || ["crests", "foam", "depth"];
      const layers = waveParts.includes("depth") ? scene.detail === "low" ? 2 : scene.detail === "medium" ? 3 : 4 : 1;
      const waveTime = phase("wave-flow", 0, 1) * Math.PI * 2;
      for (let layer = 0; layer < layers; layer += 1) {
        const base = h - 7 + layer * 1.45;
        const amplitude = Math.max(0.65, (2.4 - layer * 0.35) * tall);
        let last = null;
        for (let x = 0; x < w; x += 1) {
          const wave = Math.sin(x / (6.6 + layer * 1.1) + waveTime + layer * 1.1);
          const y = base + wave * amplitude;
          if (last && waveParts.includes("crests")) line(last[0], last[1], x, y, layer === 0 ? "~" : layer % 2 ? "≈" : "-", [palette.water, palette.sky[0], palette.water, palette.sky[1]][layer], 1 + layer);
          if (waveParts.includes("foam") && layer === 0 && Math.sin(x / 8 + waveTime) > 0.84) put(x, y - 1, ".", palette.light, 3);
          last = [x, y];
        }
      }
    }

    if (motifSet.has("house") && enabled("subject")) {
      const houseWidth = clamp(Math.round(w * 0.34), 24, Math.round(w * 0.56));
      const left = Math.round(centerX - houseWidth / 2);
      const right = left + houseWidth - 1;
      const wallTop = Math.round(h * 0.44);
      const wallBottom = groundY - 1;
      const roofPeakX = Math.round((left + right) / 2);
      const roofPeakY = Math.max(2, wallTop - Math.round(h * 0.22));
      const buildingColor = palette.house;
      const houseParts = scene.form?.house?.parts || ["roof", "walls", "door", "windows", "chimney"];
      const roofGlyph = scene.detail === "low" ? "/" : "#";
      if (houseParts.includes("roof")) {
        curve(left - 2, wallTop + 1, roofPeakX, roofPeakY, (roofPeakX - left) * 0.15, roofGlyph, palette.petals[1], 3);
        curve(roofPeakX, roofPeakY, right + 2, wallTop + 1, (right - roofPeakX) * -0.15, "\\", palette.petals[1], 3);
        line(left - 2, wallTop + 1, right + 2, wallTop + 1, "=", palette.petals[0], 4);
      }
      if (houseParts.includes("walls")) {
        for (let y = wallTop + 2; y <= wallBottom; y += 1) {
          put(left, y, "|", buildingColor, 3);
          put(right, y, "|", buildingColor, 3);
          if (scene.detail !== "low" && y % 3 === 0) {
            for (let x = left + 2; x < right; x += 7) put(x, y, ".", palette.petals[0], 2);
          }
        }
        line(left, wallBottom, right, wallBottom, "_", buildingColor, 4);
      }
      const doorWidth = Math.max(3, Math.round(wide * 4));
      const doorX = Math.round(centerX - doorWidth / 2);
      const doorTop = wallBottom - Math.max(4, Math.round(h * 0.16));
      if (houseParts.includes("door")) {
        line(doorX, doorTop, doorX, wallBottom, "[", palette.petals[2], 5);
        line(doorX + doorWidth, doorTop, doorX + doorWidth, wallBottom, "]", palette.petals[2], 5);
        line(doorX, doorTop, doorX + doorWidth, doorTop, "-", palette.petals[2], 5);
        put(doorX + doorWidth - 1, Math.round((doorTop + wallBottom) / 2), "o", palette.light, 6);
      }
      const windowCount = houseParts.includes("windows") ? Math.min(scene.form?.house?.windows ?? 2, 6) : 0;
      for (let i = 0; i < windowCount; i += 1) {
        const windowX = Math.round(left + (i + 1) * houseWidth / (windowCount + 1));
        if (Math.abs(windowX - centerX) < doorWidth + 2 && wallBottom - wallTop > 8) continue;
        const windowY = wallTop + Math.max(3, Math.round((wallBottom - wallTop) * 0.32));
        const lit = 0.5 + 0.5 * Math.sin(phase("window-light", 0, 1) * Math.PI * 2 + i * 2.1) > 0.37;
        put(windowX - 1, windowY, "[", buildingColor, 5);
        put(windowX, windowY, lit ? "#" : ":", lit ? palette.light : palette.sky[0], 6);
        put(windowX + 1, windowY, "]", buildingColor, 5);
        put(windowX, windowY + 1, "|", buildingColor, 5);
      }
      if (houseParts.includes("chimney") && scene.detail !== "low") {
        const chimneyX = right - 4;
        line(chimneyX, roofPeakY + 2, chimneyX, roofPeakY - 2, "|", buildingColor, 4);
        line(chimneyX + 3, roofPeakY + 2, chimneyX + 3, roofPeakY - 2, "|", buildingColor, 4);
        line(chimneyX, roofPeakY - 2, chimneyX + 3, roofPeakY - 2, "_", buildingColor, 4);
        if (motifSet.has("smoke")) {
          for (let i = 0; i < 5; i += 1) {
            const drift = time * Math.PI * 2 + i * 1.25;
            put(chimneyX + 2 + Math.sin(drift) * 2, roofPeakY - 4 - i * 1.4, i % 2 ? "~" : ".", palette.sky[i % 2], 1);
          }
        }
      }
      if (houseParts.includes("door")) {
        const pathStart = wallBottom + 1;
        for (let offset = 0; offset < Math.max(3, Math.round(h * 0.11)); offset += 1) {
          const spread = Math.round(offset * 0.8);
          put(doorX - spread, pathStart + offset, ".", palette.house, 1);
          put(doorX + doorWidth + spread, pathStart + offset, ".", palette.house, 1);
        }
      }
    }

    if (motifSet.has("flower") && enabled("subject")) {
      const fx = centerX + Math.sin(time * Math.PI * 2) * 0.45 * wide;
      const fy = Math.round(h * 0.39);
      const stemBaseX = centerX + Math.sin(time * Math.PI * 2) * 0.55 * wide;
      const stemTopY = fy + Math.round(h * 0.12);
      const stemX = stemBaseX + Math.sin(time * Math.PI * 2) * 0.9 * wide;
      const stemBend = phase("stem-settle", 0, 0.2, "ease-out") * close;
      const stemColor = palette.leaf;
      if (scene.form?.flower?.parts?.includes("stem")) {
        const sway = Math.sin(time * Math.PI * 2);
        const bend = (stemX - stemBaseX + 2.3 * wide) * (0.45 + stemBend * 0.12);
        curve(stemX, groundY, stemBaseX + sway * 0.3, stemTopY, bend, "|", stemColor, 3);
        curve(stemX - 1, groundY, stemBaseX + sway * 0.3, stemTopY, bend, ":", palette.vein, 2);
        curve(stemX + 1, groundY, stemBaseX + sway * 0.3, stemTopY, bend, "|", stemColor, 2);
      }

      const leafProgress = phase("leaves-unfurl", 0.1, 0.39) * close;
      const leafCount = Math.max(1, Math.min(4, scene.form?.flower?.leaves ?? 3));
      const leafShape = (x, y, direction, size, index) => {
        const length = size * leafProgress;
        const tipX = x + direction * length * 1.2 * (w / h) * 0.56;
        const tipY = y - length * 0.4;
        const points = [];
        for (let step = 0; step <= 12; step += 1) {
          const along = step / 12;
          const fullness = Math.sin(along * Math.PI) ** 0.8;
          const middleX = x + (tipX - x) * along;
          const middleY = y + (tipY - y) * along;
          const halfHeight = fullness * Math.max(0.7, size * 0.36);
          for (const side of [-1, -0.5, 0, 0.5, 1]) {
            const px = middleX - side * direction * halfHeight * 0.38;
            const py = middleY + side * halfHeight;
            const edge = Math.abs(side) > 0.75;
            put(px, py, edge ? (direction > 0 ? (side < 0 ? "/" : "\\") : (side < 0 ? "\\" : "/")) : side === 0 ? "." : ":", edge ? stemColor : side < 0 ? palette.vein : stemColor, 4);
            if (edge) points.push([px, py]);
          }
          if (step > 1 && step < 11 && step % 3 === index % 3) {
            line(middleX, middleY, middleX - direction * halfHeight * 0.3, middleY + halfHeight * 0.75, ".", palette.vein, 5);
          }
        }
        line(x, y, tipX, tipY, "-", palette.vein, 6);
      };
      if (leafProgress > 0.05 && scene.form?.flower?.parts?.includes("leaves")) {
        for (let i = 0; i < leafCount; i += 1) {
          const direction = i % 2 ? 1 : -1;
          const level = Math.round(groundY - h * (0.23 + i * 0.12));
          const offset = leafProgress * (4 + i % 2 * 1.5) * wide;
          leafShape(stemBaseX + direction * offset * 0.12, level, direction, 5 + i % 2, i);
        }
      }
      if (scene.detail === "high" && scene.form?.flower?.parts?.includes("thorns")) {
        for (let i = 0; i < 3; i += 1) {
          const y = groundY - Math.round(h * (0.16 + i * 0.13));
          line(stemBaseX - 1, y, stemBaseX - 3, y - 1, "<", palette.leaf, 4);
        }
      }

      const outer = phase("outer-petals", 0.2, 0.49, "ease-out") * close;
      const middle = phase("middle-petals", 0.34, 0.64) * close;
      const inner = phase("inner-petals", 0.5, 0.75, "ease-out") * close;
      const form = scene.form?.flower || {};
      const petalLayer = (count, scale, radiusY, colorOffset, depth, isOpen) => {
        const effective = 0.12 + 0.88 * scale;
        const lobes = Math.max(4, Math.round(count * (0.5 + 0.5 * effective)));
        const length = Math.max(0.8, radiusY * 1.35 * effective);
        const widthAcross = Math.max(0.5, radiusY * 0.26 * effective);
        const aspect = clamp((w / h) * 0.56, 1.25, 2.1);
        const sides = scene.detail === "low" ? [-1, 0, 1] : [-1, -0.5, 0, 0.5, 1];
        for (let i = 0; i < lobes; i += 1) {
          const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2 + colorOffset * Math.PI / (lobes * 2) + Math.sin(time * Math.PI * 2) * 0.035;
          const directionX = Math.cos(angle);
          const directionY = Math.sin(angle);
          const points = Math.max(7, Math.round(length * 2.2));
          const petalColor = palette.petals[Math.min(3, colorOffset + 1)];
          const base = colorOffset === 0 ? 0.24 : colorOffset === 1 ? 0.18 : 0.1;
          for (let step = 0; step <= points; step += 1) {
            const progress = step / points;
            const along = base + (1 - base) * progress;
            const fullness = Math.sin(progress * Math.PI) ** 0.52;
            const centerX = fx + directionX * length * along * aspect;
            const centerY = fy + directionY * length * along;
            const halfWidth = fullness * widthAcross;
            for (const side of sides) {
              const x = centerX - directionY * halfWidth * side * aspect;
              const y = centerY + directionX * halfWidth * side;
              const contour = Math.abs(side) > 0.8;
              const highlight = side < -0.45;
              if (!contour && step % 2 !== 0) continue;
              const glyph = contour ? (step % 3 === 0 ? "." : ":") : side === 0 ? (step % 4 === 0 ? "+" : ".") : step % 3 === 0 ? "'" : ".";
              const shade = contour ? palette.petals[colorOffset] : side === 0 ? palette.petals[Math.min(3, colorOffset + 2)] : highlight ? palette.petals[3] : petalColor;
              put(x, y, glyph, shade, depth + (contour ? 1 : 0));
            }
          }
          if (isOpen > 0.4) {
            const foldStart = base + 0.12;
            const foldEnd = 0.68;
            line(
              fx + directionX * length * foldStart * aspect,
              fy + directionY * length * foldStart,
              fx + directionX * length * foldEnd * aspect,
              fy + directionY * length * foldEnd,
              i % 2 ? ":" : "'",
              palette.petals[3],
              depth + 2
            );
          }
        }
      };
      if (form.parts?.includes("outer-petals")) petalLayer(form.outerPetals ?? 10, outer, 6.1 * tall, 0, 5, outer);
      if (form.parts?.includes("middle-petals")) petalLayer(form.middlePetals ?? 8, middle, 4.4 * tall, 1, 7, middle);
      if (form.parts?.includes("inner-petals")) petalLayer(form.innerPetals ?? 6, inner, 2.6 * tall, 2, 9, inner);

      if (middle > 0.2) {
        for (let i = 0; i < 5; i += 1) {
          const angle = Math.PI * 0.5 + (i - 2) * 0.42;
          const startX = fx + Math.cos(angle) * 1.4;
          const startY = fy + 2;
          const endX = fx + Math.cos(angle) * (3 + Math.abs(i - 2));
          const endY = fy + 5;
          line(startX, startY, endX, endY, i % 2 ? "/" : "\\", stemColor, 11);
        }
      }

      const bud = 1 - Math.max(outer, middle * 0.92);
      if (bud > 0.35) {
        for (let i = 0; i < 5; i += 1) {
          const offset = i - 2;
          const height = 1 + (2 - Math.abs(offset)) * 1.25;
          for (let y = -height; y <= 1; y += 1) {
            const x = fx + offset * 1.15;
            const glyph = y === -height ? (offset < 0 ? "/" : "\\") : y === 1 ? "_" : i % 2 ? ":" : "@";
            put(x, fy + y, glyph, y === -height ? palette.petals[2] : palette.petals[1], 11);
          }
        }
        for (let i = 0; i < 5; i += 1) {
          const angle = (i / 5) * Math.PI * 2;
          line(fx + Math.cos(angle) * 1.3, fy + 2, fx + Math.cos(angle) * 3.2, fy + 4, "v", stemColor, 10);
        }
      }
      if (scene.detail !== "low" && inner > 0.25 && form.parts?.includes("stamens")) {
        const center = palette.light;
        const stamenCount = Math.max(3, Math.min(10, form.stamens ?? 7));
        for (let i = 0; i < stamenCount; i += 1) {
          const angle = i / stamenCount * Math.PI * 2 + time * 0.16;
          const length = (1.1 + (i % 3) * 0.6) * inner;
          const sx = fx + Math.cos(angle) * length * (w / h) * 0.55;
          const sy = fy + Math.sin(angle) * length * 0.68;
          line(fx, fy, sx, sy, i % 2 ? "'" : ".", palette.petals[3], 12);
          put(sx, sy, i % 3 ? "*" : "o", center, 13);
        }
        put(fx, fy, "@", center, 14);
      }
      if (enabled("foreground")) {
        for (let i = 0; i < Math.round(4 + 8 * density); i += 1) {
          const x = centerX + (hash(i, 9, 23) - 0.5) * w * 0.45;
          const y = groundY + hash(i, 4, 29);
          const height = 1 + hash(i, 2, 31) * 2.4;
          const direction = hash(i, 7, 37) > 0.5 ? 1 : -1;
          line(x, y, x + direction * height, y - height, i % 3 ? "'" : "/", palette.leaf, 3);
        }
        for (let i = 0; i < 3; i += 1) {
          const x = centerX + (i - 1) * 2;
          put(x, groundY, i === 1 ? "#" : "_", palette.leaf, 5);
        }
      }
    }

    if (motifSet.has("ring") && enabled("subject")) {
      const cx = centerX;
      const cy = Math.round(h * 0.45);
      const angle = phase("ring-turn", 0, 1) * Math.PI * 2;
      const rx = Math.min(w * 0.24, h * 0.78);
      const ry = Math.min(h * 0.29, w * 0.13);
      const facets = scene.form?.ring?.facets ?? 12;
      const rings = scene.form?.ring?.rings ?? 2;
      const ringParts = scene.form?.ring?.parts || ["rings", "facets", "orbit"];
      for (let band = ringParts.includes("rings") ? rings - 1 : -1; band >= 0; band -= 1) {
        const scale = 1 - band * 0.14;
        const points = Math.max(100, Math.round(w * 2.4));
        for (let i = 0; i <= points; i += 1) {
          const theta = i / points * Math.PI * 2;
          const facet = ringParts.includes("facets") ? Math.abs(Math.sin(theta * facets / 2 + angle * 2)) : 0.5;
          const x = cx + Math.cos(theta) * rx * scale * Math.cos(angle) + Math.sin(theta) * Math.sin(angle) * rx * 0.08;
          const y = cy + Math.sin(theta) * ry * scale;
          const front = Math.sin(theta) * Math.sin(angle) > -0.1;
          const glyph = facet > 0.86 ? "*" : facet > 0.52 ? "=" : front ? "o" : ".";
          put(x, y, glyph, facet > 0.84 ? palette.light : front ? palette.sky[0] : palette.sky[1], band ? 3 : 6);
        }
      }
      if (ringParts.includes("orbit")) {
        const highlight = angle + Math.PI * 0.2;
        const hx = cx + Math.cos(highlight) * rx * Math.cos(angle);
        const hy = cy + Math.sin(highlight) * ry;
        put(hx, hy, "*", palette.light, 8);
      }
      if (ringParts.includes("orbit") && scene.detail !== "low") {
        const orbAngle = -angle + Math.PI * 0.22;
        const ox = cx + Math.cos(orbAngle) * rx * 1.15;
        const oy = cy + Math.sin(orbAngle) * ry * 1.15;
        line(ox - 2, oy, ox, oy, ".", palette.sky[1], 2);
        put(ox, oy, "O", palette.light, 9);
      }
    }

    if (motifSet.has("fireworks") && enabled("particles")) {
      const fireworkParts = scene.form?.fireworks?.parts || ["bursts", "trails"];
      const bursts = fireworkParts.includes("bursts") ? Math.max(1, Math.min(4, scene.form?.fireworks?.bursts ?? 3)) : 0;
      const rays = scene.detail === "low" ? 8 : scene.detail === "medium" ? 12 : scene.form?.fireworks?.rays ?? 16;
      for (let burst = 0; burst < bursts; burst += 1) {
        const local = fract(phase("bursts", 0, 1) * 2 + burst / bursts);
        const expansion = Math.sin(local * Math.PI);
        const radius = expansion * Math.min(h * 0.3, w * 0.09);
        const bx = w * (0.24 + (burst % 3) * 0.26);
        const by = h * (0.25 + (burst % 2) * 0.13);
        const fade = smooth(expansion);
        for (let ray = 0; ray < rays; ray += 1) {
          const theta = ray / rays * Math.PI * 2 + burst * 0.27;
          const jitter = 0.76 + hash(ray, burst, 41) * 0.42;
          const endX = bx + Math.cos(theta) * radius * jitter * (w / h) * 0.58;
          const endY = by + Math.sin(theta) * radius * jitter * 0.7;
          const trailX = bx + Math.cos(theta) * Math.max(0, radius - 2.2) * jitter * (w / h) * 0.58;
          const trailY = by + Math.sin(theta) * Math.max(0, radius - 2.2) * jitter * 0.7;
          const color = palette.petals[(ray + burst) % palette.petals.length];
          if (fireworkParts.includes("trails")) {
            line(trailX, trailY, endX, endY, fade > 0.66 ? (ray % 4 ? "+" : "*") : fade > 0.22 ? "." : "·", fade > 0.35 ? color : palette.sky[0], 7);
          } else {
            put(endX, endY, fade > 0.5 ? "*" : ".", color, 7);
          }
          if (scene.detail === "high" && local < 0.75) {
            put(bx + Math.cos(theta) * radius * jitter * (w / h) * 0.45, by + Math.sin(theta) * radius * jitter * 0.56 + 1, ".", palette.light, 6);
          }
        }
        put(bx, by, local < 0.7 ? "*" : ".", palette.light, 8);
      }
    }

    if (motifSet.has("smoke") && enabled("particles")) {
      const smokeParts = scene.form?.smoke?.parts || ["drift", "wisps"];
      const wisps = smokeParts.includes("wisps") ? Math.min(scene.form?.smoke?.wisps ?? 8, scene.detail === "low" ? 4 : scene.detail === "medium" ? 7 : 12) : 1;
      const originY = motifSet.has("house") ? Math.round(h * 0.19) : h - 5;
      const smokeTime = phase("smoke-drift", 0, 1);
      for (let i = 0; i < wisps; i += 1) {
        const progress = fract(smokeTime + i / wisps);
        const rise = (0.5 - 0.5 * Math.cos(progress * Math.PI * 2)) * h * 0.28;
        const drift = Math.sin(smokeTime * Math.PI * 2 + i * 1.4) * (2 + (0.5 - 0.5 * Math.cos(progress * Math.PI * 2)) * 3);
        const x = centerX + drift + Math.sin(progress * Math.PI * 2 + i) * 1.5;
        const y = originY - rise;
        const glyph = i % 3 === 0 ? ":" : i % 3 === 1 ? ")" : "~";
        put(x, y, glyph, palette.sky[i % 2], 4);
        if (smokeParts.includes("drift") && scene.detail !== "low") put(x + 1, y - 1, i % 2 ? "·" : "~", palette.sky[(i + 1) % 2], 3);
      }
    }

    if (enabled("foreground") && (motifSet.has("house") || motifSet.has("waves"))) {
      const ground = motifSet.has("waves") ? h - 4 : groundY;
      for (let x = 0; x < w; x += 1) {
        const wave = motifSet.has("waves") ? Math.sin(x / 8 + time * Math.PI * 2) * 0.7 : 0;
        if (hash(x, 6, 8) > 0.84) put(x, ground + wave, hash(x, 7, 9) > 0.5 ? "_" : ".", palette.leaf, 3);
      }
    }

    if (enabled("particles") && motifSet.has("flower")) {
      const count = Math.round((scene.detail === "low" ? 2 : scene.detail === "medium" ? 4 : 7) * density);
      for (let i = 0; i < count; i += 1) {
        const drift = Math.sin(time * Math.PI * 2 + i * 1.8);
        const x = centerX + Math.sin(time * Math.PI * 2 + i * 2.1) * (7 + i * 1.3) * wide;
        const y = h * (0.4 + Math.cos(time * Math.PI * 2 + i * 2.7) * 0.16) + drift * 1.2;
        put(x, y, i % 3 ? "." : "*", i % 3 ? palette.sky[0] : palette.light, 10);
      }
    }

    return rows;
  };
}

export function createFrameRenderer() {
  const draw = createSceneRenderer();
  return (scene, seconds, width = 100, height = 32) => draw(scene, seconds, width, height).map((row) => row.map((cell) => cell.glyph).join("").replace(/\s+$/, "")).join("\n");
}

export function createFrameColorizer(draw = createSceneRenderer()) {
  const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (scene, _frame, seconds, width = 100, height = 32) => {
    const rows = draw(scene, seconds, width, height, true);
    return rows.map((row) => {
      let html = "";
      let lastColor = null;
      let run = "";
      const flush = () => {
        if (!run) return;
        html += lastColor ? `<span style="color:${lastColor}">${escapeHtml(run)}</span>` : escapeHtml(run);
        run = "";
      };
      row.forEach((cell) => {
        const glyph = cell.glyph;
        const nextColor = glyph === " " ? null : cell.color || "#c2d7c7";
        if (nextColor !== lastColor) flush();
        lastColor = nextColor;
        run += glyph;
      });
      flush();
      return html;
    }).join("\n");
  };
}

export const renderFrame = createFrameRenderer();
export const colorizeFrame = createFrameColorizer();

export function createStandaloneHtml(scene) {
  const payload = JSON.stringify(scene).replace(/</g, "\\u003c");
  const renderer = `(${createSceneRenderer.toString()})()`;
  const colorizer = `(${createFrameColorizer.toString()})(render)`;
  const safeTitle = scene.title.replace(/[<>&"]/g, "");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} — CMDream Studio</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090e0d;color:#b8f2c8;font:14px ui-monospace,Consolas,monospace}.frame{width:min(100%,1100px);padding:18px}.bar{display:flex;align-items:center;gap:14px;padding:12px 16px;border:1px solid #303a39;border-bottom:0;border-radius:10px 10px 0 0;background:#191e1e;color:#aab8b0;font-size:12px}.lights{display:flex;gap:6px}.lights i{width:9px;height:9px;border-radius:50%;background:#fd766c}.lights i:nth-child(2){background:#ffc45b}.lights i:nth-child(3){background:#61d48a}pre{margin:0;overflow:hidden;padding:18px 12px;min-height:400px;border:1px solid #303a39;border-radius:0 0 10px 10px;background:radial-gradient(ellipse at 50% 45%,#0b1114 0,#070a0c 48%,#030405 100%);box-shadow:inset 0 0 90px #000b;font-size:clamp(5px,1vw,11px);line-height:1.22;white-space:pre;text-shadow:0 0 9px #76e9b533}.footer{padding:10px 14px;color:#7f9c88;font-size:11px}</style><main class="frame"><header class="bar"><span class="lights"><i></i><i></i><i></i></span><strong>CMDREAM STUDIO</strong><span>cmdream@studio: ~/dreams</span><span style="margin-left:auto">LIVE · LOOP</span></header><pre id="art"></pre><div class="footer">Generated from a validated CMDream scene plan · No model code is executed</div></main><script>const scene=${payload};const render=${renderer};const colorize=${colorizer};const art=document.querySelector("#art");const start=performance.now();function tick(now){const t=((now-start)/1000)%scene.duration;const width=Math.max(24,Math.min(120,Math.floor(art.clientWidth/(parseFloat(getComputedStyle(art).fontSize)*.61))));const height=Math.max(16,Math.min(40,Math.floor(art.clientHeight/(parseFloat(getComputedStyle(art).fontSize)*1.22))));art.innerHTML=colorize(scene,"",t,width,height);requestAnimationFrame(tick)}requestAnimationFrame(tick);</script>`;
}
