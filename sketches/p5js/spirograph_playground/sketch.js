// Spirograph Playground
// Run from the repo root with: python3 -m http.server 8000
// Then open: http://localhost:8000/sketches/p5js/spirograph_playground/

const PALETTE_URL = "./palettes.yml";
const FALLBACK_PALETTES = [
  { name: "fallback_black_on_white", background: [255, 255, 255], points: [0, 0, 0] },
];
const DEFAULT_BG = [255, 255, 255];
const DEFAULT_FG = [0, 0, 0];
const TRAIL_ALPHA = 180;
const TWO_PI_VALUE = Math.PI * 2;
const PREVIEW_EXPORT_SIZE = 900;
const MAX_PLAYBACK_STEPS_PER_FRAME = 2400;
const MAX_TOTAL_STEPS = 10000000;
const GENERATED_TOTAL_STEPS = MAX_TOTAL_STEPS;
const SPARKLE_TRAIL_LIMIT = 180;
const MAX_REDRAW_VERTICES = 140000;
const FIT_SAMPLE_POINTS = 120000;
const MIN_DRAW_SPEED = 0.01;
const MAX_DRAW_SPEED = 1;
const DISPLAY_FRAME_RATE = 60;
const RECIPE_VERSION = 3;
const PERMANENT_TRAIL_OPACITY = 0.1;
const RECENT_TRAIL_OPACITY = 0.9;
const FRESH_TRAIL_REPEATS = 1;
const RECENT_FADE_REPEATS = 6;
const RECENT_FADE_CHUNKS = 18;
const RECENT_CHUNK_VERTEX_LIMIT = 9000;
const FIXED_PIECES = [
  { id: "ring96", label: "96", radius: 96, variant: "hypotrochoid" },
  { id: "ring120", label: "120", radius: 120, variant: "hypotrochoid" },
  { id: "outer72", label: "72", radius: 72, variant: "epitrochoid" },
  { id: "outer96", label: "96", radius: 96, variant: "epitrochoid" },
];
const ROLLING_WHEELS = [
  { id: "wheel24", label: "24", radius: 24 },
  { id: "wheel32", label: "32", radius: 32 },
  { id: "wheel40", label: "40", radius: 40 },
  { id: "wheel52", label: "52", radius: 52 },
  { id: "wheel64", label: "64", radius: 64 },
];
const PEN_HOLES = [
  { id: "nearCenter", label: "Near center", ratio: 0.34 },
  { id: "middle", label: "Middle", ratio: 0.62 },
  { id: "nearEdge", label: "Near edge", ratio: 0.88 },
  { id: "outerReach", label: "Outer reach", ratio: 1.16 },
];
const FIXED_PIECE_BY_ID = Object.fromEntries(FIXED_PIECES.map((piece) => [piece.id, piece]));
const ROLLING_WHEEL_BY_ID = Object.fromEntries(ROLLING_WHEELS.map((wheel) => [wheel.id, wheel]));
const PEN_HOLE_BY_ID = Object.fromEntries(PEN_HOLES.map((hole) => [hole.id, hole]));

let ui = {};
let palettes = FALLBACK_PALETTES.slice();
let recipe = null;
let pathPoints = emptyPathPoints();
let baseTrailLayer = null;
let recentTrailLayer = null;
let sparkLayer = null;
let sparkles = [];
let canvasSize = 720;
let currentStep = 0;
let renderedStep = 0;
let isPlaying = true;
let playDirection = 1;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(10, 10);
  canvas.parent("canvasMount");
  canvas.elt.addEventListener("contextmenu", (event) => event.preventDefault());

  cacheUi();
  buildShapeControls();
  installUiEvents();
  ui.speedRange.value = formatSpeedValue(MAX_DRAW_SPEED);
  syncSpeedUi();
  resizeArtworkCanvas();

  loadPalettes().then((loadedPalettes) => {
    palettes = loadedPalettes.length > 0 ? loadedPalettes : FALLBACK_PALETTES.slice();
    randomizeArtwork();
  });
}

function draw() {
  if (!recipe || pathPoints.length === 0 || !baseTrailLayer || !recentTrailLayer) {
    background(245, 243, 238);
    return;
  }

  if (isPlaying) {
    advancePlayback();
  }

  const colors = activeColors();
  syncArtworkBackground(colors);
  background(...colors.background);
  image(baseTrailLayer, 0, 0);
  image(recentTrailLayer, 0, 0);
  updateSparkles();
  image(sparkLayer, 0, 0);
}

function windowResized() {
  resizeArtworkCanvas();
}

function cacheUi() {
  ui = {
    modeSelect: document.getElementById("modeSelect"),
    shapeControls: document.getElementById("shapeControls"),
    fixedVariantRow: document.getElementById("fixedVariantRow"),
    fixedSizeRow: document.getElementById("fixedSizeRow"),
    wheelSizeRow: document.getElementById("wheelSizeRow"),
    wheelIcon: document.getElementById("wheelIcon"),
    penHoleDots: document.getElementById("penHoleDots"),
    epicycleControls: document.getElementById("epicycleControls"),
    epiSymmetryRange: document.getElementById("epiSymmetryRange"),
    epiSymmetryValue: document.getElementById("epiSymmetryValue"),
    epiWobbleAmountRange: document.getElementById("epiWobbleAmountRange"),
    epiWobbleAmountValue: document.getElementById("epiWobbleAmountValue"),
    epiWobbleFreqRange: document.getElementById("epiWobbleFreqRange"),
    epiWobbleFreqValue: document.getElementById("epiWobbleFreqValue"),
    epiRotationDriftRange: document.getElementById("epiRotationDriftRange"),
    epiRotationDriftValue: document.getElementById("epiRotationDriftValue"),
    bgColorInput: document.getElementById("bgColorInput"),
    fgColorInput: document.getElementById("fgColorInput"),
    randomizeBtn: document.getElementById("randomizeBtn"),
    restartBtn: document.getElementById("restartBtn"),
    playPauseBtn: document.getElementById("playPauseBtn"),
    jumpEndBtn: document.getElementById("jumpEndBtn"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    fullscreenExitBtn: document.getElementById("fullscreenExitBtn"),
    speedRange: document.getElementById("speedRange"),
    speedValue: document.getElementById("speedValue"),
    progressRange: document.getElementById("progressRange"),
    progressValue: document.getElementById("progressValue"),
    savePreviewBtn: document.getElementById("savePreviewBtn"),
    copyRecipeBtn: document.getElementById("copyRecipeBtn"),
    saveRecipeBtn: document.getElementById("saveRecipeBtn"),
    loadRecipeBtn: document.getElementById("loadRecipeBtn"),
    recipeBox: document.getElementById("recipeBox"),
    canvasStage: document.querySelector(".canvas-stage"),
    controlsPane: document.getElementById("controlsPane"),
    controlsToggleBtn: document.getElementById("controlsToggleBtn"),
    mobileRandomBtn: document.getElementById("mobileRandomBtn"),
    mobilePlayPauseBtn: document.getElementById("mobilePlayPauseBtn"),
    mobileFullscreenBtn: document.getElementById("mobileFullscreenBtn"),
  };
}

function buildShapeControls() {
  ui.fixedSizeRow.innerHTML = "";
  ui.wheelSizeRow.innerHTML = "";
  ui.penHoleDots.innerHTML = "";

  FIXED_PIECES.forEach((piece) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "size-btn";
    button.dataset.fixedId = piece.id;
    button.dataset.variant = piece.variant;
    button.textContent = piece.label;
    button.setAttribute("aria-label", `${piece.variant === "hypotrochoid" ? "Ring" : "Outer gear"} radius ${piece.radius}`);
    ui.fixedSizeRow.appendChild(button);
  });

  ROLLING_WHEELS.forEach((wheel) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "size-btn";
    button.dataset.wheelId = wheel.id;
    button.textContent = wheel.label;
    button.setAttribute("aria-label", `Wheel radius ${wheel.radius}`);
    ui.wheelSizeRow.appendChild(button);
  });

  const wheelIconRadius = 32;
  const svgNs = "http://www.w3.org/2000/svg";
  PEN_HOLES.forEach((hole) => {
    const cx = wheelIconRadius * hole.ratio;
    const dot = document.createElementNS(svgNs, "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", "0");
    dot.setAttribute("r", "3.4");
    dot.classList.add("pen-hole-dot");
    dot.dataset.penHoleId = hole.id;
    const title = document.createElementNS(svgNs, "title");
    title.textContent = hole.label;
    dot.appendChild(title);
    ui.penHoleDots.appendChild(dot);
  });
}

function installUiEvents() {
  ui.modeSelect.addEventListener("change", () => {
    randomizeArtwork({ mode: ui.modeSelect.value });
  });

  ui.randomizeBtn.addEventListener("click", () => randomizeArtwork());
  ui.restartBtn.addEventListener("click", restartArtwork);
  ui.playPauseBtn.addEventListener("click", togglePlayback);
  ui.jumpEndBtn.addEventListener("click", jumpToEnd);
  ui.fullscreenBtn.addEventListener("click", enterFullscreen);
  ui.fullscreenExitBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    exitAppFullscreen();
  });
  ui.mobileRandomBtn.addEventListener("click", () => randomizeArtwork());
  ui.mobilePlayPauseBtn.addEventListener("click", togglePlayback);
  ui.mobileFullscreenBtn.addEventListener("click", enterFullscreen);
  ui.controlsToggleBtn.addEventListener("click", toggleControlsDrawer);

  ui.canvasStage.addEventListener("click", handleCanvasStageTap);

  ui.fixedVariantRow.querySelectorAll("[data-variant]").forEach((btn) => {
    btn.addEventListener("click", () => applyFixedVariant(btn.dataset.variant));
  });
  ui.fixedSizeRow.addEventListener("click", (event) => {
    const target = event.target.closest("[data-fixed-id]");
    if (!target) return;
    applyShapeChange({ fixedPieceId: target.dataset.fixedId });
  });
  ui.wheelSizeRow.addEventListener("click", (event) => {
    const target = event.target.closest("[data-wheel-id]");
    if (!target) return;
    applyShapeChange({ wheelId: target.dataset.wheelId });
  });
  ui.penHoleDots.addEventListener("click", (event) => {
    const target = event.target.closest("[data-pen-hole-id]");
    if (!target) return;
    applyShapeChange({ penHoleId: target.dataset.penHoleId });
  });

  ui.epiSymmetryRange.addEventListener("input", () => applyEpicycleChange("symmetry", Number(ui.epiSymmetryRange.value)));
  ui.epiWobbleAmountRange.addEventListener("input", () => applyEpicycleChange("wobbleAmount", Number(ui.epiWobbleAmountRange.value)));
  ui.epiWobbleFreqRange.addEventListener("input", () => applyEpicycleChange("wobbleFrequency", Number(ui.epiWobbleFreqRange.value)));
  ui.epiRotationDriftRange.addEventListener("input", () => applyEpicycleChange("rotationDrift", Number(ui.epiRotationDriftRange.value) * Math.PI));

  ui.bgColorInput.addEventListener("input", () => applyColorChange("background", ui.bgColorInput.value));
  ui.fgColorInput.addEventListener("input", () => applyColorChange("points", ui.fgColorInput.value));

  ui.speedRange.addEventListener("input", () => {
    if (recipe) {
      recipe.drawSpeed = normalizeDrawSpeed(ui.speedRange.value);
      syncRecipeBox();
    }
    syncSpeedUi();
  });

  ui.progressRange.addEventListener("input", () => {
    if (!recipe) return;
    isPlaying = false;
    currentStep = Number(ui.progressRange.value);
    playDirection = 1;
    renderTrailToStep(currentStep);
  });

  ui.savePreviewBtn.addEventListener("click", savePreview);
  ui.copyRecipeBtn.addEventListener("click", copyRecipe);
  ui.saveRecipeBtn.addEventListener("click", saveRecipe);
  ui.loadRecipeBtn.addEventListener("click", loadRecipeFromBox);
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      exitAppFullscreen();
    }
    resizeArtworkCanvas();
    syncFullscreenUi();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.canvasStage.classList.contains("is-app-fullscreen")) {
      exitAppFullscreen();
    }
  });
}

function handleCanvasStageTap(event) {
  if (!ui.canvasStage.classList.contains("is-app-fullscreen")) return;
  if (event.target.closest(".fullscreen-toolbar")) return;
  ui.canvasStage.classList.toggle("controls-visible");
}

async function loadPalettes() {
  try {
    const response = await fetch(PALETTE_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Palette request failed: ${response.status}`);
    }
    return parsePaletteYaml(await response.text());
  } catch (error) {
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
  });

  pushPaletteIfValid(parsed, current);
  return parsed;
}

function pushPaletteIfValid(list, item) {
  if (!item) return;
  const hasRgb = Array.isArray(item.background) && Array.isArray(item.points);
  if (!item.name || !hasRgb) return;
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

function randomizeArtwork(overrides = {}) {
  const mode = overrides.mode || ui.modeSelect.value || "classic";
  const seed = makeRecipeSeed();
  const colors = overrides.colors || pickRandomColors(seed);
  const shapeSelection = overrides.shapeSelection;
  const nextRecipe = makeRecipe({ mode, seed, colors, shapeSelection });
  applyRecipe(nextRecipe, { startPlaying: true });
}

function pickRandomColors(seed) {
  if (palettes.length === 0) {
    return { background: DEFAULT_BG.slice(), points: DEFAULT_FG.slice() };
  }
  const rng = mulberry32(seed ^ 0xa1b2c3d4);
  const choice = palettes[Math.floor(rng() * palettes.length) % palettes.length];
  return {
    background: choice.background.slice(),
    points: choice.points.slice(),
  };
}

function makeRecipe({ mode, seed, colors, shapeSelection }) {
  const safeMode = mode === "epicycle" ? "epicycle" : "classic";
  const safeColors = normalizeColors(colors);
  const generated =
    safeMode === "epicycle" ? makeEpicycleParams(seed) : makeClassicParams(seed, shapeSelection);

  return {
    version: RECIPE_VERSION,
    app: "spirograph_playground",
    mode: safeMode,
    seed,
    colors: safeColors,
    canvas: { aspect: 1 },
    totalSteps: generated.totalSteps,
    drawSpeed: normalizeDrawSpeed(ui.speedRange.value),
    ...(generated.shape ? { shape: generated.shape } : {}),
    params: generated.params,
  };
}

function applyRecipe(nextRecipe, options = {}) {
  recipe = normalizeRecipe(nextRecipe);
  pathPoints = generatePathPoints(recipe);
  currentStep = clamp(Math.round(Number(recipe.currentStep || 0)), 0, recipe.totalSteps);
  renderedStep = 0;
  sparkles = [];
  playDirection = recipe.playDirection === -1 ? -1 : 1;
  isPlaying = options.startPlaying ?? false;

  ui.modeSelect.value = recipe.mode;
  ui.speedRange.value = formatSpeedValue(recipe.drawSpeed);
  ui.progressRange.max = String(recipe.totalSteps);
  ui.progressRange.value = String(currentStep);
  ui.bgColorInput.value = rgbToHex(recipe.colors.background);
  ui.fgColorInput.value = rgbToHex(recipe.colors.points);

  syncArtworkBackground(recipe.colors);
  syncShapeControls();
  syncEpicycleControls();
  syncSpeedUi();
  syncRecipeBox();
  renderTrailToStep(currentStep);
  syncProgressUi();
  syncPlaybackUi();
  syncFullscreenUi();
}

function normalizeRecipe(source) {
  const mode = source.mode === "epicycle" ? "epicycle" : "classic";
  const seed = Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : makeRecipeSeed();
  const colors = colorsFromRecipeSource(source, seed);
  const fallback = makeRecipe({ mode, seed, colors, shapeSelection: source.shape });
  const totalSteps = clamp(
    Math.round(Number(source.totalSteps || fallback.totalSteps)),
    1200,
    MAX_TOTAL_STEPS,
  );
  const drawSpeed = normalizeDrawSpeed(source.drawSpeed ?? ui.speedRange.value);
  const currentStepValue = clamp(Math.round(Number(source.currentStep || 0)), 0, totalSteps);
  const progressPercent = totalSteps > 0 ? roundForRecipe((currentStepValue / totalSteps) * 100) : 0;
  const playDirectionValue = source.playDirection === -1 ? -1 : 1;
  const params =
    mode === "epicycle"
      ? normalizeEpicycleParams(source.params || fallback.params)
      : normalizeClassicParams(source.params || fallback.params);
  const shapeSource =
    mode === "classic"
      ? source.shape || (source.params ? shapeFromClassicParams(params) : fallback.shape)
      : null;
  const shape =
    mode === "classic"
      ? normalizeClassicShape(shapeSource || shapeFromClassicParams(params), params)
      : null;

  return {
    version: RECIPE_VERSION,
    app: "spirograph_playground",
    mode,
    seed,
    colors,
    canvas: { aspect: 1 },
    totalSteps,
    drawSpeed,
    currentStep: currentStepValue,
    progressPercent,
    playDirection: playDirectionValue,
    ...(shape ? { shape } : {}),
    params,
  };
}

function colorsFromRecipeSource(source, seed) {
  if (source.colors && Array.isArray(source.colors.background) && Array.isArray(source.colors.points)) {
    return normalizeColors(source.colors);
  }
  if (source.paletteName) {
    const found = palettes.find((palette) => palette.name === source.paletteName);
    if (found) return normalizeColors({ background: found.background, points: found.points });
  }
  if (Number.isInteger(source.paletteIndex) && palettes[source.paletteIndex]) {
    const palette = palettes[source.paletteIndex];
    return normalizeColors({ background: palette.background, points: palette.points });
  }
  return pickRandomColors(seed);
}

function normalizeColors(colors) {
  const background = Array.isArray(colors?.background) ? clampRgb(colors.background) : DEFAULT_BG.slice();
  const points = Array.isArray(colors?.points) ? clampRgb(colors.points) : DEFAULT_FG.slice();
  return { background, points };
}

function clampRgb(rgb) {
  return [0, 1, 2].map((i) => clamp(Math.round(Number(rgb[i]) || 0), 0, 255));
}

function applyFixedVariant(variant) {
  if (!recipe || recipe.mode !== "classic") return;
  const matching = FIXED_PIECES.filter((piece) => piece.variant === variant);
  if (matching.length === 0) return;
  const currentPiece = FIXED_PIECE_BY_ID[recipe.shape?.fixedPieceId];
  const nextPiece = currentPiece && currentPiece.variant === variant ? currentPiece : matching[0];
  applyShapeChange({ fixedPieceId: nextPiece.id });
}

function applyShapeChange(partial) {
  if (!recipe || recipe.mode !== "classic") return;
  const nextShape = { ...recipe.shape, ...partial };
  const generated = makeClassicParams(recipe.seed, nextShape);
  recipe.shape = generated.shape;
  recipe.params = generated.params;
  pathPoints = generatePathPoints(recipe);
  currentStep = clamp(currentStep, 0, recipe.totalSteps);
  syncShapeControls();
  syncRecipeBox();
  renderTrailToStep(currentStep);
  syncProgressUi();
}

function applyEpicycleChange(key, value) {
  if (!recipe || recipe.mode !== "epicycle") return;
  recipe.params = normalizeEpicycleParams({ ...recipe.params, [key]: value });
  pathPoints = generatePathPoints(recipe);
  currentStep = clamp(currentStep, 0, recipe.totalSteps);
  syncEpicycleControls();
  syncRecipeBox();
  renderTrailToStep(currentStep);
  syncProgressUi();
}

function applyColorChange(channel, hexValue) {
  if (!recipe) return;
  const rgb = hexToRgb(hexValue);
  if (!rgb) return;
  recipe.colors = normalizeColors({ ...recipe.colors, [channel]: rgb });
  syncArtworkBackground(recipe.colors);
  renderTrailToStep(currentStep);
  syncRecipeBox();
}

function syncShapeControls() {
  if (!ui.shapeControls) return;
  const classicActive = recipe?.mode === "classic";
  ui.shapeControls.classList.toggle("is-disabled", !classicActive);
  ui.shapeControls.hidden = !classicActive;
  ui.epicycleControls.hidden = classicActive;

  if (!classicActive || !recipe.shape) return;

  const activeFixed = FIXED_PIECE_BY_ID[recipe.shape.fixedPieceId];
  const activeVariant = activeFixed ? activeFixed.variant : "hypotrochoid";

  ui.fixedVariantRow.querySelectorAll("[data-variant]").forEach((btn) => {
    const matches = btn.dataset.variant === activeVariant;
    btn.classList.toggle("is-active", matches);
    btn.setAttribute("aria-pressed", String(matches));
  });

  ui.fixedSizeRow.querySelectorAll("[data-fixed-id]").forEach((btn) => {
    const visible = btn.dataset.variant === activeVariant;
    btn.style.display = visible ? "" : "none";
    const matches = btn.dataset.fixedId === recipe.shape.fixedPieceId;
    btn.classList.toggle("is-active", matches);
    btn.setAttribute("aria-pressed", String(matches));
  });

  ui.wheelSizeRow.querySelectorAll("[data-wheel-id]").forEach((btn) => {
    const matches = btn.dataset.wheelId === recipe.shape.wheelId;
    btn.classList.toggle("is-active", matches);
    btn.setAttribute("aria-pressed", String(matches));
  });

  ui.penHoleDots.querySelectorAll("[data-pen-hole-id]").forEach((dot) => {
    const matches = dot.dataset.penHoleId === recipe.shape.penHoleId;
    dot.classList.toggle("is-active", matches);
  });
}

function syncEpicycleControls() {
  if (!ui.epicycleControls) return;
  const epicycleActive = recipe?.mode === "epicycle";
  ui.epicycleControls.hidden = !epicycleActive;
  if (!epicycleActive || !recipe.params) return;

  const symmetry = Math.round(Number(recipe.params.symmetry) || 4);
  const wobbleAmount = Number(recipe.params.wobbleAmount) || 0;
  const wobbleFreq = Number(recipe.params.wobbleFrequency) || 1;
  const driftPi = (Number(recipe.params.rotationDrift) || 0) / Math.PI;

  ui.epiSymmetryRange.value = String(clamp(symmetry, 3, 9));
  ui.epiSymmetryValue.textContent = String(clamp(symmetry, 3, 9));
  ui.epiWobbleAmountRange.value = String(clamp(wobbleAmount, 0, 0.2));
  ui.epiWobbleAmountValue.textContent = wobbleAmount.toFixed(2);
  ui.epiWobbleFreqRange.value = String(clamp(wobbleFreq, 0.5, 8));
  ui.epiWobbleFreqValue.textContent = wobbleFreq.toFixed(1);
  ui.epiRotationDriftRange.value = String(clamp(driftPi, -10, 10));
  ui.epiRotationDriftValue.textContent = driftPi.toFixed(1);
}

function normalizeClassicShape(sourceShape, params) {
  const inferred = shapeFromClassicParams(params);
  const fixedPieceId = FIXED_PIECE_BY_ID[sourceShape?.fixedPieceId]
    ? sourceShape.fixedPieceId
    : inferred.fixedPieceId;
  const wheelId = ROLLING_WHEEL_BY_ID[sourceShape?.wheelId] ? sourceShape.wheelId : inferred.wheelId;
  const penHoleId = PEN_HOLE_BY_ID[sourceShape?.penHoleId] ? sourceShape.penHoleId : inferred.penHoleId;

  return { fixedPieceId, wheelId, penHoleId };
}

function shapeFromClassicParams(params = {}) {
  const variant = params.variant === "epitrochoid" ? "epitrochoid" : "hypotrochoid";
  const matchingPieces = FIXED_PIECES.filter((piece) => piece.variant === variant);
  const fixedPiece = closestBy(matchingPieces, params.fixedRadius || matchingPieces[0].radius, "radius");
  const wheel = closestBy(ROLLING_WHEELS, params.rollingRadius || ROLLING_WHEELS[0].radius, "radius");
  const penRatio = wheel.radius > 0 ? (params.penDistance || wheel.radius * 0.62) / wheel.radius : 0.62;
  const penHole = closestBy(PEN_HOLES, penRatio, "ratio");

  return {
    fixedPieceId: fixedPiece.id,
    wheelId: wheel.id,
    penHoleId: penHole.id,
  };
}

function normalizeClassicParams(params = {}) {
  const fixedRadius = Number(params.fixedRadius);
  const rollingRadius = Number(params.rollingRadius);
  const tMax = Number(params.tMax);
  const safeParams = {
    ...params,
    variant: params.variant === "epitrochoid" ? "epitrochoid" : "hypotrochoid",
    fixedRadius: Number.isFinite(fixedRadius) ? fixedRadius : 96,
    rollingRadius: Number.isFinite(rollingRadius) ? rollingRadius : 40,
    penDistance: Number.isFinite(Number(params.penDistance)) ? Number(params.penDistance) : 24.8,
    phase: Number.isFinite(Number(params.phase)) ? Number(params.phase) : 0,
    rotation: Number.isFinite(Number(params.rotation)) ? Number(params.rotation) : 0,
    rotationDrift: Number.isFinite(Number(params.rotationDrift)) ? Number(params.rotationDrift) : 0,
    penWobble: Number.isFinite(Number(params.penWobble)) ? Number(params.penWobble) : 0,
    wobbleFrequency: Number.isFinite(Number(params.wobbleFrequency)) ? Number(params.wobbleFrequency) : 1,
    wobblePhase: Number.isFinite(Number(params.wobblePhase)) ? Number(params.wobblePhase) : 0,
    tMax: Number.isFinite(tMax) ? tMax : TWO_PI_VALUE * 48,
  };

  if (!Number.isFinite(Number(safeParams.repeatCount)) || Number(safeParams.repeatCount) <= 0) {
    const closeTurns = clamp(
      safeParams.rollingRadius / gcd(Math.round(safeParams.fixedRadius), Math.round(safeParams.rollingRadius)),
      1,
      64,
    );
    safeParams.repeatCount = Math.max(1, Math.round(safeParams.tMax / (TWO_PI_VALUE * closeTurns)));
  }

  return safeParams;
}

function normalizeEpicycleParams(params = {}) {
  const components =
    Array.isArray(params.components) && params.components.length > 0
      ? params.components
      : [{ radius: 1, frequency: 1, phase: 0 }];
  const safeParams = {
    ...params,
    symmetry: Number.isFinite(Number(params.symmetry)) ? Number(params.symmetry) : 4,
    rotation: Number.isFinite(Number(params.rotation)) ? Number(params.rotation) : 0,
    rotationDrift: Number.isFinite(Number(params.rotationDrift)) ? Number(params.rotationDrift) : 0,
    wobbleAmount: Number.isFinite(Number(params.wobbleAmount)) ? Number(params.wobbleAmount) : 0,
    wobbleFrequency: Number.isFinite(Number(params.wobbleFrequency)) ? Number(params.wobbleFrequency) : 1,
    wobblePhase: Number.isFinite(Number(params.wobblePhase)) ? Number(params.wobblePhase) : 0,
    components,
    tMax: Number.isFinite(Number(params.tMax)) ? Number(params.tMax) : TWO_PI_VALUE * 48,
  };

  if (!Number.isFinite(Number(safeParams.repeatCount)) || Number(safeParams.repeatCount) <= 0) {
    safeParams.repeatCount = Math.max(1, Math.round(safeParams.tMax / TWO_PI_VALUE));
  }

  return safeParams;
}

function closestBy(items, value, key) {
  return items.reduce((closest, item) => {
    return Math.abs(item[key] - value) < Math.abs(closest[key] - value) ? item : closest;
  }, items[0]);
}

function makeClassicParams(seed, shapeSelection) {
  const rng = mulberry32(seed);
  const shape = resolveClassicShapeSelection(shapeSelection, rng);
  const fixedPiece = FIXED_PIECE_BY_ID[shape.fixedPieceId];
  const wheel = ROLLING_WHEEL_BY_ID[shape.wheelId];
  const penHole = PEN_HOLE_BY_ID[shape.penHoleId];
  const variant = fixedPiece.variant;
  const fixedRadius = fixedPiece.radius;
  const rollingRadius = wheel.radius;

  const common = gcd(fixedRadius, rollingRadius);
  const closeTurns = clamp(rollingRadius / common, 2, 12);
  const passCount = randomInt(rng, 24, 64);
  const penDistance = rollingRadius * penHole.ratio;
  const phase = randomBetween(rng, 0, TWO_PI_VALUE);
  const rotation = randomBetween(rng, 0, TWO_PI_VALUE);
  const rotationDrift = randomBetween(rng, -TWO_PI_VALUE * 2.75, TWO_PI_VALUE * 2.75);
  const penWobble = randomBetween(rng, 0.015, 0.085);
  const wobbleFrequency = randomBetween(rng, 2.2, 9.5);
  const wobblePhase = randomBetween(rng, 0, TWO_PI_VALUE);
  const totalSteps = GENERATED_TOTAL_STEPS;

  return {
    totalSteps,
    shape,
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
      repeatCount: passCount,
      tMax: roundForRecipe(TWO_PI_VALUE * closeTurns * passCount),
    },
  };
}

function resolveClassicShapeSelection(selection, rng) {
  const fixedPieceId = FIXED_PIECE_BY_ID[selection?.fixedPieceId]
    ? selection.fixedPieceId
    : FIXED_PIECES[randomInt(rng, 0, FIXED_PIECES.length - 1)].id;
  const wheelId = ROLLING_WHEEL_BY_ID[selection?.wheelId]
    ? selection.wheelId
    : ROLLING_WHEELS[randomInt(rng, 0, ROLLING_WHEELS.length - 1)].id;
  const penHoleId = PEN_HOLE_BY_ID[selection?.penHoleId]
    ? selection.penHoleId
    : PEN_HOLES[randomInt(rng, 0, PEN_HOLES.length - 1)].id;
  return { fixedPieceId, wheelId, penHoleId };
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
      repeatCount: passCount,
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
  const fullscreenActive = document.fullscreenElement === stage || stage?.classList.contains("is-app-fullscreen");
  const heightLimit = fullscreenActive ? window.innerHeight : Math.max(320, window.innerHeight - 96);
  const maxCanvasSize = fullscreenActive ? 1600 : 920;
  const nextSize = clamp(Math.floor(Math.min(stageWidth, heightLimit, maxCanvasSize)), 320, maxCanvasSize);

  canvasSize = nextSize;
  resizeCanvas(canvasSize, canvasSize);
  if (mount) {
    mount.style.maxWidth = `${canvasSize}px`;
  }

  baseTrailLayer = createGraphics(canvasSize, canvasSize);
  baseTrailLayer.pixelDensity(1);
  recentTrailLayer = createGraphics(canvasSize, canvasSize);
  recentTrailLayer.pixelDensity(1);
  sparkLayer = createGraphics(canvasSize, canvasSize);
  sparkLayer.pixelDensity(1);
  renderTrailToStep(currentStep);
}

function renderTrailToStep(step) {
  if (!baseTrailLayer || !recentTrailLayer || !recipe || pathPoints.length === 0) return;
  clearTransparentLayer(baseTrailLayer);
  clearTransparentLayer(recentTrailLayer);
  drawBaseTrailToStep(step, baseTrailLayer, canvasSize);
  drawRecentTrailToStep(step, recentTrailLayer, canvasSize, playDirection);
  renderedStep = step;
  clearSparkles();
  syncProgressUi();
}

function clearTransparentLayer(target) {
  target.clear();
}

function drawTrailCompositeToStep(step, target, size) {
  const colors = activeColors();
  target.push();
  target.background(...colors.background);
  target.pop();
  drawBaseTrailToStep(step, target, size);
  drawRecentTrailToStep(step, target, size, playDirection);
}

function drawBaseTrailToStep(step, target, size) {
  drawBaseTrailSegment(0, step, target, size);
}

function drawBaseTrailSegment(fromStep, toStep, target, size) {
  if (!recipe || toStep <= fromStep || pathPoints.length === 0) return;
  const colors = activeColors();
  const alpha = TRAIL_ALPHA * PERMANENT_TRAIL_OPACITY;
  const start = clamp(Math.floor(fromStep), 0, recipe.totalSteps);
  const end = clamp(Math.floor(toStep), 0, recipe.totalSteps);
  drawTrailRange(start, end, target, size, colors, alpha);
}

function drawRecentTrailToStep(step, target, size, direction = 1) {
  if (!recipe || pathPoints.length === 0) return;
  const colors = activeColors();
  const focusStep = clamp(Math.floor(step), 0, recipe.totalSteps);
  const windowSteps = recentFadeWindowSteps(recipe);

  let start;
  let end;
  let peakStep;
  if (direction >= 0) {
    start = Math.max(0, focusStep - windowSteps);
    end = focusStep;
    peakStep = end;
  } else {
    start = focusStep;
    end = Math.min(recipe.totalSteps, focusStep + windowSteps);
    peakStep = start;
  }

  const span = end - start;
  if (span <= 0) return;

  const targetChunkSteps = Math.max(1, repeatStepCount(recipe) * 0.25);
  const chunkCount = Math.max(1, Math.min(RECENT_FADE_CHUNKS, Math.ceil(span / targetChunkSteps)));
  const chunkSize = span / chunkCount;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const chunkStart = Math.floor(start + chunkSize * chunkIndex);
    const chunkEnd = Math.min(end, Math.floor(start + chunkSize * (chunkIndex + 1)));
    if (chunkEnd <= chunkStart) continue;
    const midpoint = (chunkStart + chunkEnd) * 0.5;
    const age = Math.abs(peakStep - midpoint);
    const opacity = recentTrailOpacityForAge(age, recipe);
    const alpha = TRAIL_ALPHA * RECENT_TRAIL_OPACITY * opacity;
    drawTrailRange(chunkStart, chunkEnd, target, size, colors, alpha, RECENT_CHUNK_VERTEX_LIMIT);
  }
}

function drawTrailRange(start, end, target, size, colors, alpha, maxVertices = MAX_REDRAW_VERTICES) {
  if (end <= start) return;
  if (alpha <= 0.2) return;
  const coreWeight = Math.max(3.6, size / 205);

  target.push();
  target.noFill();
  target.strokeJoin(ROUND);
  target.strokeCap(ROUND);
  target.stroke(...colors.points, alpha);
  target.strokeWeight(coreWeight);
  drawPathShape(target, start, end, size, maxVertices);
  target.pop();
}

function advancePlayback() {
  if (!recipe) return;

  const stride = playbackStride();
  const nextStep = clamp(currentStep + playDirection * stride, 0, recipe.totalSteps);

  if (playDirection > 0) {
    drawBaseTrailSegment(currentStep, nextStep, baseTrailLayer, canvasSize);
    clearTransparentLayer(recentTrailLayer);
    drawRecentTrailToStep(nextStep, recentTrailLayer, canvasSize, playDirection);
  } else {
    clearTransparentLayer(recentTrailLayer);
    drawRecentTrailToStep(nextStep, recentTrailLayer, canvasSize, playDirection);
  }

  currentStep = nextStep;
  renderedStep = nextStep;

  if (currentStep >= recipe.totalSteps) {
    playDirection = -1;
    currentStep = recipe.totalSteps;
  } else if (currentStep <= 0) {
    playDirection = 1;
    currentStep = 0;
    renderTrailToStep(0);
  }

  syncProgressUi();
}

function drawPathShape(target, start, end, size, maxVertices = MAX_REDRAW_VERTICES) {
  const step = Math.max(1, Math.ceil((end - start) / maxVertices));
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
  playDirection = 1;
  isPlaying = true;
  sparkles = [];
  renderTrailToStep(0);
}

function togglePlayback() {
  if (!recipe) return;
  isPlaying = !isPlaying;
  syncPlaybackUi();
}

function jumpToEnd() {
  if (!recipe) return;
  currentStep = recipe.totalSteps;
  playDirection = -1;
  isPlaying = false;
  renderTrailToStep(currentStep);
}

function enterFullscreen() {
  if (!ui.canvasStage) return;

  if (ui.canvasStage.classList.contains("is-app-fullscreen")) {
    exitAppFullscreen();
    return;
  }

  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  if (!ui.canvasStage.requestFullscreen) {
    enterAppFullscreen();
    return;
  }

  ui.canvasStage
    .requestFullscreen()
    .then(() => {
      if (!document.fullscreenElement) {
        enterAppFullscreen();
      }
    })
    .catch(() => {
      enterAppFullscreen();
    });
}

function enterAppFullscreen() {
  ui.canvasStage.classList.add("is-app-fullscreen");
  ui.canvasStage.classList.remove("controls-visible");
  document.body.classList.add("has-app-fullscreen");
  resizeArtworkCanvas();
  syncFullscreenUi();
}

function exitAppFullscreen() {
  ui.canvasStage.classList.remove("is-app-fullscreen");
  ui.canvasStage.classList.remove("controls-visible");
  document.body.classList.remove("has-app-fullscreen");
  resizeArtworkCanvas();
  syncFullscreenUi();
}

function playbackStride() {
  const speed = normalizeDrawSpeed(ui.speedRange.value);
  return playbackStrideForSpeed(speed);
}

function syncSpeedUi() {
  const speed = normalizeDrawSpeed(ui.speedRange.value);
  const stepsPerSecond = playbackStrideForSpeed(speed) * DISPLAY_FRAME_RATE;
  const passSeconds = recipe ? recipe.totalSteps / stepsPerSecond : MAX_TOTAL_STEPS / stepsPerSecond;
  ui.speedValue.textContent = `${formatStepRate(stepsPerSecond)} steps/sec @60fps • ${formatDuration(passSeconds)} / pass`;
}

function playbackStrideForSpeed(speed) {
  return Math.max(1, Math.round(1 + Math.pow(speed, 2.2) * (MAX_PLAYBACK_STEPS_PER_FRAME - 1)));
}

function normalizeDrawSpeed(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return MAX_DRAW_SPEED;
  }

  const migratedValue = numericValue > MAX_DRAW_SPEED ? numericValue / 100 : numericValue;
  return roundForRecipe(clamp(migratedValue, MIN_DRAW_SPEED, MAX_DRAW_SPEED));
}

function formatSpeedValue(value) {
  return normalizeDrawSpeed(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatStepRate(value) {
  if (value >= 1000000) {
    return `${roundForRecipe(value / 1000000)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return String(Math.round(value));
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return "--";

  const roundedSeconds = Math.max(1, Math.round(totalSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function syncProgressUi() {
  if (!recipe) return;
  ui.progressRange.max = String(recipe.totalSteps);
  ui.progressRange.value = String(currentStep);
  ui.progressValue.textContent = `${Math.round((currentStep / recipe.totalSteps) * 100)}%`;
}

function syncPlaybackUi() {
  const label = isPlaying ? "Pause" : "Play";
  ui.playPauseBtn.textContent = label;
  if (ui.mobilePlayPauseBtn) ui.mobilePlayPauseBtn.textContent = label;
}

function toggleControlsDrawer() {
  const isOpen = ui.controlsPane.classList.toggle("is-open");
  ui.controlsToggleBtn.textContent = isOpen ? "Hide controls" : "Show controls";
  ui.controlsToggleBtn.setAttribute("aria-expanded", String(isOpen));
}

function syncFullscreenUi() {
  if (!ui.fullscreenBtn) return;
  const isFullscreen = Boolean(document.fullscreenElement) || ui.canvasStage?.classList.contains("is-app-fullscreen");
  const label = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
  ui.fullscreenBtn.textContent = label;
  if (ui.mobileFullscreenBtn) ui.mobileFullscreenBtn.textContent = label;
}

function syncRecipeBox() {
  if (!recipe) return;
  ui.recipeBox.value = JSON.stringify(recipeForCurrentStep(), null, 2);
}

function recipeForCurrentStep() {
  const safeStep = recipe ? clamp(Math.round(currentStep), 0, recipe.totalSteps) : 0;
  const progressPercent = recipe && recipe.totalSteps > 0 ? roundForRecipe((safeStep / recipe.totalSteps) * 100) : 0;

  return {
    ...recipe,
    currentStep: safeStep,
    progressPercent,
    playDirection,
  };
}

async function copyRecipe() {
  if (!recipe) return;
  syncRecipeBox();
  const text = ui.recipeBox.value;

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    ui.recipeBox.focus();
    ui.recipeBox.select();
  }
}

function saveRecipe() {
  if (!recipe) return;
  syncRecipeBox();
  const blob = new Blob([ui.recipeBox.value], { type: "application/json" });
  downloadBlob(blob, `spirograph-recipe-${recipe.seed}.json`);
}

function loadRecipeFromBox() {
  try {
    const loaded = JSON.parse(ui.recipeBox.value);
    applyRecipe(loaded, { startPlaying: false });
  } catch (error) {
    console.warn("Recipe JSON did not load", error);
  }
}

function savePreview() {
  if (!recipe || pathPoints.length === 0) return;
  const preview = createGraphics(PREVIEW_EXPORT_SIZE, PREVIEW_EXPORT_SIZE);
  preview.pixelDensity(1);
  drawTrailCompositeToStep(currentStep, preview, PREVIEW_EXPORT_SIZE);
  drawPreviewCursor(preview, PREVIEW_EXPORT_SIZE);
  drawWatermark(preview, PREVIEW_EXPORT_SIZE);

  preview.canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `spirograph-preview-${recipe.seed}.png`);
    }
    preview.remove();
  }, "image/png");
}

function drawPreviewCursor(target, size) {
  const colors = activeColors();
  const mapped = mapPathIndexToCanvas(currentStep, size);
  const sparkColor = sparkColorForColors(colors);
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
  const colors = activeColors();
  const lightBackground = luminance(colors.background) > 150;
  const fillColor = lightBackground ? [255, 255, 255, 206] : [0, 0, 0, 172];
  const textColor = lightBackground ? [32, 33, 36, 218] : [255, 255, 255, 224];
  const label = `preview | seed ${recipe.seed}`;

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

  const colors = activeColors();
  sparkLayer.clear();

  if (isPlaying && currentStep > 0 && currentStep < recipe.totalSteps) {
    emitSparkles(colors);
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

function emitSparkles(colors) {
  const mapped = mapPathIndexToCanvas(currentStep, canvasSize);
  const previousMapped = mapPathIndexToCanvas(currentStep - playDirection * playbackStride(), canvasSize);
  const angle = Math.atan2(mapped.y - previousMapped.y, mapped.x - previousMapped.x);
  const count = 1;
  const color = sparkColorForColors(colors);

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
      size: random(canvasSize * 0.0013, canvasSize * 0.0036),
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

function isDarkBackground(colors) {
  return luminance(colors.background) < 90;
}

function sparkColorForColors(colors) {
  return isDarkBackground(colors) ? warmSparkColor(colors.points) : colors.points;
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

function recentFadeWindowSteps(activeRecipe) {
  return repeatStepCount(activeRecipe) * (FRESH_TRAIL_REPEATS + RECENT_FADE_REPEATS);
}

function recentTrailOpacityForAge(ageSteps, activeRecipe) {
  const freshSteps = repeatStepCount(activeRecipe) * FRESH_TRAIL_REPEATS;
  if (ageSteps <= freshSteps) return 1;

  const fadeSteps = Math.max(1, repeatStepCount(activeRecipe) * RECENT_FADE_REPEATS);
  const fadeProgress = clamp((ageSteps - freshSteps) / fadeSteps, 0, 1);
  return Math.pow(1 - fadeProgress, 1.15);
}

function repeatStepCount(activeRecipe) {
  const repeatCount = Math.max(1, Number(activeRecipe.params?.repeatCount) || inferRepeatCount(activeRecipe));
  return Math.max(1, Math.round(activeRecipe.totalSteps / repeatCount));
}

function inferRepeatCount(activeRecipe) {
  if (activeRecipe.mode === "epicycle") {
    return Math.max(1, Math.round((activeRecipe.params?.tMax || TWO_PI_VALUE) / TWO_PI_VALUE));
  }

  const params = activeRecipe.params || {};
  const closeTurns = clamp(
    (params.rollingRadius || 1) / gcd(Math.round(params.fixedRadius || 1), Math.round(params.rollingRadius || 1)),
    1,
    64,
  );
  return Math.max(1, Math.round((params.tMax || TWO_PI_VALUE) / (TWO_PI_VALUE * closeTurns)));
}

function syncArtworkBackground(colors) {
  if (!ui.canvasStage || !colors) return;
  ui.canvasStage.style.setProperty("--artwork-background", `rgb(${colors.background.join(",")})`);
}

function emptyPathPoints() {
  return {
    fit: null,
    length: 0,
  };
}

function activeColors() {
  if (recipe?.colors) return recipe.colors;
  return { background: DEFAULT_BG.slice(), points: DEFAULT_FG.slice() };
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

function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  const trimmed = hex.replace("#", "").trim();
  if (trimmed.length !== 6) return null;
  const r = parseInt(trimmed.slice(0, 2), 16);
  const g = parseInt(trimmed.slice(2, 4), 16);
  const b = parseInt(trimmed.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return [r, g, b];
}

function rgbToHex(rgb) {
  const pad = (n) => clamp(Math.round(Number(n) || 0), 0, 255).toString(16).padStart(2, "0");
  return `#${pad(rgb[0])}${pad(rgb[1])}${pad(rgb[2])}`;
}
