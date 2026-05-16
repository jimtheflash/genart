// Spirograph Playground
// Run from the repo root with: python3 -m http.server 8000
// Then open: http://localhost:8000/sketches/p5js/spirograph_playground/

const PALETTE_URL = "../../../lib/palettes/clifford_attractor_basic.yml";
const FALLBACK_PALETTES = [
  { name: "fallback_black_on_white", background: [255, 255, 255], points: [0, 0, 0], alpha: 190 },
];
const TWO_PI_VALUE = Math.PI * 2;
const PREVIEW_EXPORT_SIZE = 900;
const TARGET_DRAW_SECONDS_AT_MAX_SPEED = 120;
const ASSUMED_FRAME_RATE = 60;
const MAX_PLAYBACK_STEPS_PER_FRAME = 3000;
const GENERATED_TOTAL_STEPS =
  TARGET_DRAW_SECONDS_AT_MAX_SPEED * ASSUMED_FRAME_RATE * MAX_PLAYBACK_STEPS_PER_FRAME;
const SPARKLE_TRAIL_LIMIT = 180;
const MAX_REDRAW_VERTICES = 140000;
const FIT_SAMPLE_POINTS = 120000;

let ui = {};
let palettes = FALLBACK_PALETTES.slice();
let recipe = null;
let pathPoints = emptyPathPoints();
let trailLayer = null;
let sparkLayer = null;
let sparkles = [];
let canvasSize = 720;
let currentStep = 0;
let renderedStep = 0;
let isPlaying = true;
let paletteLoadMessage = "Using fallback palette";

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(10, 10);
  canvas.parent("canvasMount");
  canvas.elt.addEventListener("contextmenu", (event) => event.preventDefault());

  cacheUi();
  installUiEvents();
  resizeArtworkCanvas();

  loadPalettes().then((loadedPalettes) => {
    palettes = loadedPalettes.length > 0 ? loadedPalettes : FALLBACK_PALETTES.slice();
    paletteLoadMessage = `Loaded ${palettes.length} palettes`;
    populatePaletteSelect();
    randomizeArtwork();
  });
}

function draw() {
  if (!recipe || pathPoints.length === 0 || !trailLayer) {
    background(245, 243, 238);
    return;
  }

  if (isPlaying && currentStep < recipe.totalSteps) {
    const nextStep = Math.min(recipe.totalSteps, currentStep + playbackStride());
    drawTrailSegment(currentStep, nextStep, trailLayer, canvasSize);
    currentStep = nextStep;
    renderedStep = nextStep;

    if (currentStep >= recipe.totalSteps) {
      isPlaying = false;
    }

    syncProgressUi();
  }

  const palette = activePalette();
  background(...palette.background);
  image(trailLayer, 0, 0);
  updateSparkles();
  image(sparkLayer, 0, 0);
  drawActivePoint();
  syncPlaybackUi();
}

function windowResized() {
  resizeArtworkCanvas();
}

function cacheUi() {
  ui = {
    modeSelect: document.getElementById("modeSelect"),
    paletteSelect: document.getElementById("paletteSelect"),
    randomizeBtn: document.getElementById("randomizeBtn"),
    restartBtn: document.getElementById("restartBtn"),
    playPauseBtn: document.getElementById("playPauseBtn"),
    jumpEndBtn: document.getElementById("jumpEndBtn"),
    speedRange: document.getElementById("speedRange"),
    speedValue: document.getElementById("speedValue"),
    progressRange: document.getElementById("progressRange"),
    progressValue: document.getElementById("progressValue"),
    savePreviewBtn: document.getElementById("savePreviewBtn"),
    copyRecipeBtn: document.getElementById("copyRecipeBtn"),
    saveRecipeBtn: document.getElementById("saveRecipeBtn"),
    loadRecipeBtn: document.getElementById("loadRecipeBtn"),
    recipeBox: document.getElementById("recipeBox"),
    statusLine: document.getElementById("statusLine"),
  };
}

function installUiEvents() {
  ui.modeSelect.addEventListener("change", () => {
    randomizeArtwork({ mode: ui.modeSelect.value });
  });

  ui.paletteSelect.addEventListener("change", () => {
    if (!recipe) return;
    const paletteIndex = Number(ui.paletteSelect.value);
    recipe.paletteIndex = paletteIndex;
    recipe.paletteName = palettes[paletteIndex].name;
    renderTrailToStep(currentStep);
    syncRecipeBox();
  });

  ui.randomizeBtn.addEventListener("click", () => randomizeArtwork());
  ui.restartBtn.addEventListener("click", restartArtwork);
  ui.playPauseBtn.addEventListener("click", togglePlayback);
  ui.jumpEndBtn.addEventListener("click", jumpToEnd);

  ui.speedRange.addEventListener("input", () => {
    if (recipe) {
      recipe.drawSpeed = Number(ui.speedRange.value);
      syncRecipeBox();
    }
    syncSpeedUi();
  });

  ui.progressRange.addEventListener("input", () => {
    if (!recipe) return;
    isPlaying = false;
    currentStep = Number(ui.progressRange.value);
    renderTrailToStep(currentStep);
  });

  ui.savePreviewBtn.addEventListener("click", savePreview);
  ui.copyRecipeBtn.addEventListener("click", copyRecipe);
  ui.saveRecipeBtn.addEventListener("click", saveRecipe);
  ui.loadRecipeBtn.addEventListener("click", loadRecipeFromBox);
}

async function loadPalettes() {
  try {
    const response = await fetch(PALETTE_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Palette request failed: ${response.status}`);
    }
    return parsePaletteYaml(await response.text());
  } catch (error) {
    paletteLoadMessage = "Palette YAML unavailable";
    console.warn(error);
    return FALLBACK_PALETTES.slice();
  }
}

function parsePaletteYaml(text) {
  const parsed = [];
  let current = null;

  text.split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line || line.startsWith("#") || line === "palettes:") return;

    if (line.startsWith("- ")) {
      pushPaletteIfValid(parsed, current);
      current = {};
      line = line.slice(2).trim();
    }

    if (!current) return;

    const colonIndex = line.indexOf(":");
    if (colonIndex < 0) return;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === "name") current.name = value;
    if (key === "background") current.background = parseRgb(value);
    if (key === "points") current.points = parseRgb(value);
    if (key === "alpha") current.alpha = clamp(Number(value), 0, 255);
  });

  pushPaletteIfValid(parsed, current);
  return parsed;
}

function pushPaletteIfValid(list, item) {
  if (!item) return;
  const hasRgb = Array.isArray(item.background) && Array.isArray(item.points);
  if (!item.name || !hasRgb || !Number.isFinite(item.alpha)) return;
  list.push(item);
}

function parseRgb(value) {
  const channels = value
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map((piece) => clamp(Number(piece.trim()), 0, 255));

  return channels.length === 3 && channels.every(Number.isFinite) ? channels : null;
}

function populatePaletteSelect() {
  ui.paletteSelect.innerHTML = "";
  palettes.forEach((palette, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = palette.name;
    ui.paletteSelect.appendChild(option);
  });
}

function randomizeArtwork(overrides = {}) {
  const mode = overrides.mode || ui.modeSelect.value || "classic";
  const paletteIndex = resolvePaletteIndex(overrides.paletteIndex ?? ui.paletteSelect.value);
  const seed = makeRecipeSeed();
  const nextRecipe = makeRecipe({ mode, seed, paletteIndex });
  applyRecipe(nextRecipe, { startPlaying: true });
}

function makeRecipe({ mode, seed, paletteIndex }) {
  const safeMode = mode === "epicycle" ? "epicycle" : "classic";
  const safePaletteIndex = resolvePaletteIndex(paletteIndex);
  const generator = safeMode === "epicycle" ? makeEpicycleParams : makeClassicParams;
  const generated = generator(seed);

  return {
    version: 1,
    app: "spirograph_playground",
    mode: safeMode,
    seed,
    paletteIndex: safePaletteIndex,
    paletteName: palettes[safePaletteIndex].name,
    canvas: { aspect: 1 },
    totalSteps: generated.totalSteps,
    drawSpeed: Number(ui.speedRange.value),
    params: generated.params,
  };
}

function applyRecipe(nextRecipe, options = {}) {
  recipe = normalizeRecipe(nextRecipe);
  pathPoints = generatePathPoints(recipe);
  currentStep = 0;
  renderedStep = 0;
  sparkles = [];
  isPlaying = options.startPlaying ?? false;

  ui.modeSelect.value = recipe.mode;
  ui.paletteSelect.value = String(recipe.paletteIndex);
  ui.speedRange.value = String(recipe.drawSpeed);
  ui.progressRange.max = String(recipe.totalSteps);
  ui.progressRange.value = "0";

  syncSpeedUi();
  syncRecipeBox();
  renderTrailToStep(0);
}

function normalizeRecipe(source) {
  const mode = source.mode === "epicycle" ? "epicycle" : "classic";
  const seed = Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : makeRecipeSeed();
  let paletteIndex = resolvePaletteIndex(source.paletteIndex);

  if (source.paletteName) {
    const foundIndex = palettes.findIndex((palette) => palette.name === source.paletteName);
    if (foundIndex >= 0) paletteIndex = foundIndex;
  }

  const fallback = makeRecipe({ mode, seed, paletteIndex });
  const totalSteps = clamp(
    Math.round(Number(source.totalSteps || fallback.totalSteps)),
    1200,
    GENERATED_TOTAL_STEPS * 2,
  );
  const drawSpeed = clamp(Math.round(Number(source.drawSpeed || ui.speedRange.value)), 1, 100);

  return {
    version: 1,
    app: "spirograph_playground",
    mode,
    seed,
    paletteIndex,
    paletteName: palettes[paletteIndex].name,
    canvas: { aspect: 1 },
    totalSteps,
    drawSpeed,
    params: source.params || fallback.params,
  };
}

function makeClassicParams(seed) {
  const rng = mulberry32(seed);
  const variant = rng() < 0.58 ? "hypotrochoid" : "epitrochoid";
  let fixedRadius = randomInt(rng, 5, 14);
  let rollingRadius = randomInt(rng, 2, 9);

  if (fixedRadius === rollingRadius) {
    rollingRadius += 1;
  }

  const common = gcd(fixedRadius, rollingRadius);
  const closeTurns = clamp(rollingRadius / common, 2, 12);
  const passCount = randomInt(rng, 24, 64);
  const penDistance = randomBetween(rng, rollingRadius * 0.42, rollingRadius * 1.42);
  const phase = randomBetween(rng, 0, TWO_PI_VALUE);
  const rotation = randomBetween(rng, 0, TWO_PI_VALUE);
  const rotationDrift = randomBetween(rng, -TWO_PI_VALUE * 2.75, TWO_PI_VALUE * 2.75);
  const penWobble = randomBetween(rng, 0.06, 0.2);
  const wobbleFrequency = randomBetween(rng, 2.2, 9.5);
  const wobblePhase = randomBetween(rng, 0, TWO_PI_VALUE);
  const totalSteps = GENERATED_TOTAL_STEPS;

  return {
    totalSteps,
    params: {
      variant,
      fixedRadius,
      rollingRadius,
      penDistance: roundForRecipe(penDistance),
      phase: roundForRecipe(phase),
      rotation: roundForRecipe(rotation),
      rotationDrift: roundForRecipe(rotationDrift),
      penWobble: roundForRecipe(penWobble),
      wobbleFrequency: roundForRecipe(wobbleFrequency),
      wobblePhase: roundForRecipe(wobblePhase),
      tMax: roundForRecipe(TWO_PI_VALUE * closeTurns * passCount),
    },
  };
}

function makeEpicycleParams(seed) {
  const rng = mulberry32(seed);
  const componentCount = randomInt(rng, 3, 6);
  const symmetry = randomInt(rng, 3, 9);
  const passCount = randomInt(rng, 35, 90);
  const usedFrequencies = new Set();
  const components = [];
  let radius = randomBetween(rng, 0.72, 0.96);

  for (let index = 0; index < componentCount; index += 1) {
    let frequency = index === 0 ? 1 : randomInt(rng, 2, 14);
    if (index === 1) frequency = symmetry;
    if (index === 2) frequency = symmetry + randomInt(rng, 1, 4);
    if (rng() < 0.46) frequency *= -1;

    while (usedFrequencies.has(frequency) || frequency === 0) {
      frequency += frequency > 0 ? 1 : -1;
    }
    usedFrequencies.add(frequency);

    components.push({
      radius: roundForRecipe(radius),
      frequency: roundForRecipe(frequency + randomBetween(rng, -0.18, 0.18)),
      phase: roundForRecipe(randomBetween(rng, 0, TWO_PI_VALUE)),
    });

    radius *= randomBetween(rng, 0.34, 0.62);
  }

  return {
    totalSteps: GENERATED_TOTAL_STEPS,
    params: {
      symmetry,
      rotation: roundForRecipe(randomBetween(rng, 0, TWO_PI_VALUE)),
      rotationDrift: roundForRecipe(randomBetween(rng, -TWO_PI_VALUE * 1.8, TWO_PI_VALUE * 1.8)),
      wobbleAmount: roundForRecipe(randomBetween(rng, 0.025, 0.11)),
      wobbleFrequency: roundForRecipe(randomBetween(rng, 1.5, 6.5)),
      wobblePhase: roundForRecipe(randomBetween(rng, 0, TWO_PI_VALUE)),
      components,
      tMax: roundForRecipe(TWO_PI_VALUE * passCount),
    },
  };
}

function generatePathPoints(activeRecipe) {
  return {
    length: activeRecipe.totalSteps + 1,
    fit: measurePathFit(activeRecipe),
  };
}

function measurePathFit(activeRecipe) {
  const sampleCount = Math.min(FIT_SAMPLE_POINTS, activeRecipe.totalSteps);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const progress = sample / sampleCount;
    const point = rawPointForRecipe(activeRecipe, progress);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return makeFit(minX, maxX, minY, maxY, 0.84);
}

function makeFit(minX, maxX, minY, maxY, margin) {
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const range = Math.max(maxX - minX, maxY - minY, 0.00001);
  const scale = (2 * margin) / range;

  return {
    centerX,
    centerY,
    scale,
  };
}

function rawPointForRecipe(activeRecipe, progress) {
  return activeRecipe.mode === "epicycle"
    ? rawEpicyclePoint(activeRecipe.params, progress)
    : rawClassicPoint(activeRecipe.params, progress);
}

function rawClassicPoint(params, progress) {
  const R = params.fixedRadius;
  const r = params.rollingRadius;
  const baseD = params.penDistance;
  const wobble = params.penWobble || 0;
  const wobbleFrequency = params.wobbleFrequency || 1;
  const wobblePhase = params.wobblePhase || 0;
  const d = baseD * (1 + wobble * Math.sin(TWO_PI_VALUE * wobbleFrequency * progress + wobblePhase));
  const t = params.phase + params.tMax * progress;
  let x = 0;
  let y = 0;

  if (params.variant === "epitrochoid") {
    x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
  } else {
    x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
  }

  return rotatePoint({ x, y }, params.rotation + (params.rotationDrift || 0) * progress);
}

function rawEpicyclePoint(params, progress) {
  const t = params.tMax * progress;
  const wobbleAmount = params.wobbleAmount || 0;
  const wobbleFrequency = params.wobbleFrequency || 1;
  const wobblePhase = params.wobblePhase || 0;
  let x = 0;
  let y = 0;

  params.components.forEach((component, index) => {
    const angle = component.frequency * t + component.phase;
    const wobble = 1 + wobbleAmount * Math.sin(TWO_PI_VALUE * (wobbleFrequency + index * 0.37) * progress + wobblePhase);
    const radius = component.radius * wobble;
    x += radius * Math.cos(angle);
    y += radius * Math.sin(angle);
  });

  return rotatePoint({ x, y }, params.rotation + (params.rotationDrift || 0) * progress);
}

function normalizedPointAt(index) {
  if (!recipe || !pathPoints.fit) {
    return { x: 0, y: 0 };
  }

  const safeIndex = clamp(Math.floor(index), 0, Math.max(0, recipe.totalSteps));
  const progress = safeIndex / recipe.totalSteps;
  const point = rawPointForRecipe(recipe, progress);

  return {
    x: (point.x - pathPoints.fit.centerX) * pathPoints.fit.scale,
    y: (point.y - pathPoints.fit.centerY) * pathPoints.fit.scale,
  };
}

function resizeArtworkCanvas() {
  const mount = document.getElementById("canvasMount");
  const stage = document.querySelector(".canvas-stage");
  const stageWidth = stage ? stage.getBoundingClientRect().width : window.innerWidth;
  const heightLimit = Math.max(320, window.innerHeight - 96);
  const nextSize = clamp(Math.floor(Math.min(stageWidth, heightLimit, 920)), 320, 920);

  canvasSize = nextSize;
  resizeCanvas(canvasSize, canvasSize);
  if (mount) {
    mount.style.maxWidth = `${canvasSize}px`;
  }

  trailLayer = createGraphics(canvasSize, canvasSize);
  trailLayer.pixelDensity(1);
  sparkLayer = createGraphics(canvasSize, canvasSize);
  sparkLayer.pixelDensity(1);
  renderTrailToStep(currentStep);
}

function renderTrailToStep(step) {
  if (!trailLayer || !recipe || pathPoints.length === 0) return;
  clearTrail(trailLayer);
  drawTrailSegment(0, step, trailLayer, canvasSize);
  renderedStep = step;
  clearSparkles();
  syncProgressUi();
}

function clearTrail(target) {
  const palette = activePalette();
  target.push();
  target.background(...palette.background);
  target.pop();
}

function drawTrailSegment(fromStep, toStep, target, size) {
  if (!recipe || toStep <= fromStep || pathPoints.length === 0) return;
  const palette = activePalette();
  const alpha = Math.max(150, palette.alpha);
  const start = clamp(Math.floor(fromStep), 0, recipe.totalSteps);
  const end = clamp(Math.floor(toStep), 0, recipe.totalSteps);
  const darkBackground = isDarkPalette(palette);

  target.push();
  target.noFill();
  target.strokeJoin(ROUND);
  target.strokeCap(ROUND);
  if (darkBackground) {
    target.drawingContext.save();
    target.drawingContext.shadowBlur = Math.max(10, size * 0.018);
    target.drawingContext.shadowColor = rgbaString(palette.points, 0.64);
    target.stroke(...palette.points, Math.min(180, alpha + 35));
    target.strokeWeight(Math.max(3.2, size / 230));
    drawPathShape(target, start, end, size);
    target.drawingContext.restore();
  }
  target.stroke(...palette.points, alpha);
  target.strokeWeight(Math.max(1.05, size / 780));
  drawPathShape(target, start, end, size);
  target.pop();
}

function drawPathShape(target, start, end, size) {
  const step = Math.max(1, Math.ceil((end - start) / MAX_REDRAW_VERTICES));
  const halfSize = size * 0.5;

  target.beginShape();
  for (let index = start; index <= end; index += step) {
    const point = normalizedPointAt(index);
    target.vertex(halfSize + point.x * halfSize, halfSize + point.y * halfSize);
  }

  if ((end - start) % step !== 0) {
    const point = normalizedPointAt(end);
    target.vertex(halfSize + point.x * halfSize, halfSize + point.y * halfSize);
  }
  target.endShape();
}

function drawActivePoint() {
  const palette = activePalette();
  const mapped = mapPathIndexToCanvas(currentStep, canvasSize);
  const pulse = 1 + Math.sin(frameCount * 0.16) * 0.12;
  const radius = Math.max(6, canvasSize * 0.01) * pulse;
  const sparkColor = sparkColorForPalette(palette);

  push();
  drawingContext.save();
  drawingContext.shadowBlur = Math.max(12, canvasSize * 0.022);
  drawingContext.shadowColor = rgbaString(sparkColor, 0.9);
  noFill();
  stroke(...sparkColor, 235);
  strokeWeight(Math.max(1.2, canvasSize / 520));
  circle(mapped.x, mapped.y, radius * 2.6);
  fill(...sparkColor, 245);
  noStroke();
  circle(mapped.x, mapped.y, radius);
  drawingContext.restore();
  pop();
}

function mapPathIndexToCanvas(index, size) {
  const halfSize = size * 0.5;
  const point = normalizedPointAt(index);

  return {
    x: halfSize + point.x * halfSize,
    y: halfSize + point.y * halfSize,
  };
}

function restartArtwork() {
  if (!recipe) return;
  currentStep = 0;
  isPlaying = true;
  sparkles = [];
  renderTrailToStep(0);
}

function togglePlayback() {
  if (!recipe) return;
  if (currentStep >= recipe.totalSteps) {
    currentStep = 0;
    renderTrailToStep(0);
  }
  isPlaying = !isPlaying;
  syncPlaybackUi();
}

function jumpToEnd() {
  if (!recipe) return;
  currentStep = recipe.totalSteps;
  isPlaying = false;
  renderTrailToStep(currentStep);
}

function playbackStride() {
  const speed = Number(ui.speedRange.value);
  return Math.max(1, Math.round(1 + Math.pow(speed / 100, 2.2) * (MAX_PLAYBACK_STEPS_PER_FRAME - 1)));
}

function syncSpeedUi() {
  ui.speedValue.textContent = ui.speedRange.value;
}

function syncProgressUi() {
  if (!recipe) return;
  ui.progressRange.max = String(recipe.totalSteps);
  ui.progressRange.value = String(currentStep);
  ui.progressValue.textContent = `${Math.round((currentStep / recipe.totalSteps) * 100)}%`;
  syncStatus();
}

function syncPlaybackUi() {
  ui.playPauseBtn.textContent = isPlaying ? "Pause" : "Play";
}

function syncStatus(message) {
  if (message) {
    ui.statusLine.textContent = message;
    return;
  }

  if (!recipe) {
    ui.statusLine.textContent = paletteLoadMessage;
    return;
  }

  ui.statusLine.textContent = `${paletteLoadMessage} | ${recipe.mode} | seed ${recipe.seed}`;
}

function syncRecipeBox() {
  if (!recipe) return;
  ui.recipeBox.value = JSON.stringify(recipe, null, 2);
}

async function copyRecipe() {
  if (!recipe) return;
  syncRecipeBox();
  const text = ui.recipeBox.value;

  try {
    await navigator.clipboard.writeText(text);
    syncStatus("Recipe copied");
  } catch (error) {
    ui.recipeBox.focus();
    ui.recipeBox.select();
    syncStatus("Recipe selected");
  }
}

function saveRecipe() {
  if (!recipe) return;
  syncRecipeBox();
  const blob = new Blob([ui.recipeBox.value], { type: "application/json" });
  downloadBlob(blob, `spirograph-recipe-${recipe.seed}.json`);
  syncStatus("Recipe saved");
}

function loadRecipeFromBox() {
  try {
    const loaded = JSON.parse(ui.recipeBox.value);
    applyRecipe(loaded, { startPlaying: false });
    syncStatus("Recipe loaded");
  } catch (error) {
    syncStatus("Recipe JSON did not load");
  }
}

function savePreview() {
  if (!recipe || pathPoints.length === 0) return;
  const preview = createGraphics(PREVIEW_EXPORT_SIZE, PREVIEW_EXPORT_SIZE);
  preview.pixelDensity(1);
  clearPreviewGraphics(preview, PREVIEW_EXPORT_SIZE);
  drawTrailSegment(0, currentStep, preview, PREVIEW_EXPORT_SIZE);
  drawPreviewCursor(preview, PREVIEW_EXPORT_SIZE);
  drawWatermark(preview, PREVIEW_EXPORT_SIZE);

  preview.canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `spirograph-preview-${recipe.seed}.png`);
      syncStatus("Watermarked preview saved");
    }
    preview.remove();
  }, "image/png");
}

function clearPreviewGraphics(target) {
  const palette = activePalette();
  target.push();
  target.background(...palette.background);
  target.pop();
}

function drawPreviewCursor(target, size) {
  const palette = activePalette();
  const mapped = mapPathIndexToCanvas(currentStep, size);
  const sparkColor = sparkColorForPalette(palette);
  target.push();
  target.drawingContext.save();
  target.drawingContext.shadowBlur = Math.max(14, size * 0.02);
  target.drawingContext.shadowColor = rgbaString(sparkColor, 0.9);
  target.noFill();
  target.stroke(...sparkColor, 230);
  target.strokeWeight(2);
  target.circle(mapped.x, mapped.y, 22);
  target.fill(...sparkColor, 245);
  target.noStroke();
  target.circle(mapped.x, mapped.y, 10);
  target.drawingContext.restore();
  target.pop();
}

function drawWatermark(target, size) {
  const palette = activePalette();
  const lightBackground = luminance(palette.background) > 150;
  const fillColor = lightBackground ? [255, 255, 255, 206] : [0, 0, 0, 172];
  const textColor = lightBackground ? [32, 33, 36, 218] : [255, 255, 255, 224];
  const label = `preview | seed ${recipe.seed} | ${recipe.paletteName}`;

  target.push();
  target.noStroke();
  target.fill(...fillColor);
  target.rect(size * 0.025, size * 0.92, size * 0.95, size * 0.055, 8);
  target.fill(...textColor);
  target.textAlign(CENTER, CENTER);
  target.textSize(Math.max(13, size * 0.018));
  target.text(label, size * 0.5, size * 0.947);
  target.pop();
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateSparkles() {
  if (!sparkLayer || !recipe || pathPoints.length === 0) return;

  const palette = activePalette();
  sparkLayer.clear();

  if (isPlaying && currentStep < recipe.totalSteps) {
    emitSparkles(palette);
  }

  sparkLayer.push();
  sparkLayer.blendMode(ADD);
  for (let index = sparkles.length - 1; index >= 0; index -= 1) {
    const spark = sparkles[index];
    spark.life -= 1;
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vx *= 0.965;
    spark.vy *= 0.965;

    if (spark.life <= 0) {
      sparkles.splice(index, 1);
      continue;
    }

    const progress = spark.life / spark.maxLife;
    const alpha = 220 * progress * progress;
    sparkLayer.noStroke();
    sparkLayer.fill(...spark.color, alpha);
    sparkLayer.circle(spark.x, spark.y, spark.size * (0.45 + progress));
  }
  sparkLayer.pop();
}

function emitSparkles(palette) {
  const mapped = mapPathIndexToCanvas(currentStep, canvasSize);
  const previousMapped = mapPathIndexToCanvas(Math.max(0, currentStep - playbackStride()), canvasSize);
  const angle = Math.atan2(mapped.y - previousMapped.y, mapped.x - previousMapped.x);
  const count = isDarkPalette(palette) ? 5 : 3;
  const color = sparkColorForPalette(palette);

  for (let index = 0; index < count; index += 1) {
    const sideSpray = random(-1.9, 1.9);
    const speed = random(canvasSize * 0.0016, canvasSize * 0.006);
    const direction = angle + Math.PI + sideSpray;
    const life = random(12, 28);
    sparkles.push({
      x: mapped.x + random(-2, 2),
      y: mapped.y + random(-2, 2),
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      life,
      maxLife: life,
      size: random(canvasSize * 0.004, canvasSize * 0.011),
      color,
    });
  }

  if (sparkles.length > SPARKLE_TRAIL_LIMIT) {
    sparkles.splice(0, sparkles.length - SPARKLE_TRAIL_LIMIT);
  }
}

function clearSparkles() {
  sparkles = [];
  if (sparkLayer) {
    sparkLayer.clear();
  }
}

function isDarkPalette(palette) {
  return luminance(palette.background) < 90;
}

function sparkColorForPalette(palette) {
  return isDarkPalette(palette) ? warmSparkColor(palette.points) : palette.points;
}

function warmSparkColor(baseColor) {
  return [
    Math.round(baseColor[0] * 0.55 + 255 * 0.45),
    Math.round(baseColor[1] * 0.5 + 220 * 0.5),
    Math.round(baseColor[2] * 0.35 + 95 * 0.65),
  ];
}

function rgbaString(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function emptyPathPoints() {
  return {
    fit: null,
    length: 0,
  };
}

function activePalette() {
  const index = recipe ? recipe.paletteIndex : 0;
  return palettes[index] || palettes[0] || FALLBACK_PALETTES[0];
}

function resolvePaletteIndex(value) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0 && index < palettes.length) {
    return index;
  }
  return 0;
}

function rotatePoint(point, angle) {
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  return {
    x: point.x * cosAngle - point.y * sinAngle,
    y: point.x * sinAngle + point.y * cosAngle,
  };
}

function makeRecipeSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, minValue, maxValue) {
  return minValue + rng() * (maxValue - minValue);
}

function randomInt(rng, minValue, maxValue) {
  return Math.floor(randomBetween(rng, minValue, maxValue + 1));
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function roundForRecipe(value) {
  return Math.round(value * 1000000) / 1000000;
}

function luminance(rgb) {
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
}
