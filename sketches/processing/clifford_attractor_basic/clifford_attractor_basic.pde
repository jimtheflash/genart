// Clifford Attractor Basic
// Run in Processing Java mode.
//
// Controls:
// e: render and save a print PNG (dimensions from image_config.yml) to outputs/clifford_attractor_basic/
// s: save the current 900 x 900 preview PNG to outputs/clifford_attractor_basic/
// n: generate a new attractor and restart the preview
//
// Formula:
// nextX = sin(a * y) + c * cos(a * x)
// nextY = sin(b * x) + d * cos(b * y)

import java.io.File;
import java.io.PrintWriter;

final String SKETCH_NAME = "clifford_attractor_basic";
final String PALETTE_FILE = "../../../palettes.yml";
final String IMAGE_CONFIG_FILE = "../../../image_config.yml";
final int PREVIEW_SIZE = 900;
final int MIN_POINTS = 9000000;
final int MAX_POINTS = 10000000;
final int ITERATIONS_PER_FRAME = 150000;
final int EXPORT_CHUNK_POINTS = 1000000;
final int EXPORT_PROGRESS_POINTS = 1000000;
final int FIT_SAMPLE_POINTS = 180000;
final int WARMUP_POINTS = 1000;
final int RANDOM_ATTEMPTS = 80;
final float FIT_MARGIN = 0.78;
final float PRESET_JITTER = 0.04;
final float SCREEN_STROKE_WEIGHT = 0.65;

AttractorState activeState;
DrawCursor previewCursor;
PGraphics previewCanvas;
Palette[] palettes;
ImageConfig imageConfig;
int previewPointsDrawn = 0;

float[][] parameterSets = {
  {-1.7, 1.8, -1.9, -0.4},
  {-1.4, 1.6, 1.0, 0.7},
  {1.5, -1.8, 1.6, 0.9},
  {-1.8, -2.0, -0.5, -0.9},
  {1.7, 1.7, 0.6, 1.2},
  {1.3, 1.7, 0.5, 1.4},
  {-1.9, 1.9, -1.2, 1.3},
  {1.8, -1.5, 1.1, -0.8}
};

void settings() {
  size(PREVIEW_SIZE, PREVIEW_SIZE, JAVA2D);
  pixelDensity(1);
  smooth(4);
}

void setup() {
  palettes = loadPalettes();
  imageConfig = loadImageConfig(SKETCH_NAME);
  previewCanvas = createGraphics(PREVIEW_SIZE, PREVIEW_SIZE, JAVA2D);
  println("Print export configured for " + imageConfig.widthInches + " in x " + imageConfig.heightInches + " in at " + imageConfig.dpi + " dpi (" + imageConfig.widthPx + " x " + imageConfig.heightPx + " px).");
  startNewAttractor();
}

void draw() {
  int pointsThisFrame = min(ITERATIONS_PER_FRAME, activeState.pointCount - previewPointsDrawn);

  if (pointsThisFrame <= 0) {
    noLoop();
    return;
  }

  previewCanvas.beginDraw();
  drawAttractorPoints(previewCanvas, activeState, previewCursor, pointsThisFrame, PREVIEW_SIZE, PREVIEW_SIZE);
  previewCanvas.endDraw();
  image(previewCanvas, 0, 0);
  previewPointsDrawn += pointsThisFrame;

  if (previewPointsDrawn >= activeState.pointCount) {
    println("Preview finished after " + activeState.pointCount + " points.");
    noLoop();
  }
}

void keyPressed() {
  if (key == 'e' || key == 'E') {
    renderPrintExport();
  } else if (key == 's' || key == 'S') {
    savePreview();
  } else if (key == 'n' || key == 'N') {
    startNewAttractor();
  }
}

void startNewAttractor() {
  int paletteIndex = floor(random(palettes.length));
  int pointCount = randomPointCount();
  clearPreviewAndWindow(paletteIndex);

  activeState = makeRandomSearchState(paletteIndex, pointCount);

  if (activeState == null) {
    println("Random search did not find a stable attractor. Falling back to a curated preset.");
    activeState = makePresetState(paletteIndex, pointCount);
  }

  resetPreview();
  println("Clifford attractor ready.");
  println("  points=" + activeState.pointCount + " palette_index=" + activeState.paletteIndex + " palette_name=" + activePalette().name);
  println("  a=" + activeState.a + " b=" + activeState.b + " c=" + activeState.c + " d=" + activeState.d);
  println("  Press e for a " + imageConfig.widthPx + " x " + imageConfig.heightPx + " print export, s for preview PNG, n for a new attractor.");
}

AttractorState makeRandomSearchState(int paletteIndex, int pointCount) {
  for (int attempt = 0; attempt < RANDOM_ATTEMPTS; attempt++) {
    float candidateA = randomCoefficient();
    float candidateB = randomCoefficient();
    float candidateC = randomCoefficient();
    float candidateD = randomCoefficient();
    float seedX = random(-0.05, 0.05);
    float seedY = random(-0.05, 0.05);
    FitBounds bounds = measureBounds(candidateA, candidateB, candidateC, candidateD, seedX, seedY);

    if (bounds != null) {
      return makeState(candidateA, candidateB, candidateC, candidateD, seedX, seedY, paletteIndex, pointCount, bounds);
    }
  }

  return null;
}

AttractorState makePresetState(int paletteIndex, int pointCount) {
  int pick = floor(random(parameterSets.length));
  float[] base = parameterSets[pick];

  float candidateA = base[0] + random(-PRESET_JITTER, PRESET_JITTER);
  float candidateB = base[1] + random(-PRESET_JITTER, PRESET_JITTER);
  float candidateC = base[2] + random(-PRESET_JITTER, PRESET_JITTER);
  float candidateD = base[3] + random(-PRESET_JITTER, PRESET_JITTER);
  float seedX = random(-0.05, 0.05);
  float seedY = random(-0.05, 0.05);
  FitBounds bounds = measureBounds(candidateA, candidateB, candidateC, candidateD, seedX, seedY);

  if (bounds != null) {
    return makeState(candidateA, candidateB, candidateC, candidateD, seedX, seedY, paletteIndex, pointCount, bounds);
  }

  seedX = 0.01;
  seedY = 0.01;
  bounds = measureBounds(base[0], base[1], base[2], base[3], seedX, seedY);
  return makeState(base[0], base[1], base[2], base[3], seedX, seedY, paletteIndex, pointCount, bounds);
}

AttractorState makeState(float a, float b, float c, float d, float seedX, float seedY, int paletteIndex, int pointCount, FitBounds bounds) {
  AttractorState state = new AttractorState();
  state.a = a;
  state.b = b;
  state.c = c;
  state.d = d;
  state.seedX = seedX;
  state.seedY = seedY;
  state.paletteIndex = paletteIndex;
  state.pointCount = pointCount;
  state.minX = bounds.minX;
  state.maxX = bounds.maxX;
  state.minY = bounds.minY;
  state.maxY = bounds.maxY;
  state.centerX = (bounds.minX + bounds.maxX) * 0.5;
  state.centerY = (bounds.minY + bounds.maxY) * 0.5;
  state.fitMargin = FIT_MARGIN;
  return state;
}

void resetPreview() {
  previewCursor = new DrawCursor(activeState.seedX, activeState.seedY);
  skipWarmup(activeState, previewCursor);
  previewPointsDrawn = 0;
  clearPreviewAndWindow(activeState.paletteIndex);
  loop();
}

void renderPrintExport() {
  int widthPx = imageConfig.widthPx;
  int heightPx = imageConfig.heightPx;
  String outputFolder = ensureOutputFolder();
  String stamp = timestamp();
  String baseName = "clifford-attractor-basic-" + widthPx + "x" + heightPx + "-" + stamp;
  String basePath = uniqueBasePath(outputFolder, baseName);
  String pngPath = basePath + ".png";
  String metadataPath = basePath + ".txt";

  println("Starting print export at " + widthPx + " x " + heightPx + " px with " + activeState.pointCount + " points.");
  println("The Processing window may pause while the high-resolution PNG renders.");

  PGraphics printCanvas = createGraphics(widthPx, heightPx, JAVA2D);
  DrawCursor exportCursor = new DrawCursor(activeState.seedX, activeState.seedY);
  skipWarmup(activeState, exportCursor);

  printCanvas.beginDraw();
  printCanvas.smooth(4);
  clearBackground(printCanvas, activeState);

  int rendered = 0;
  int nextProgress = EXPORT_PROGRESS_POINTS;
  while (rendered < activeState.pointCount) {
    int pointsThisChunk = min(EXPORT_CHUNK_POINTS, activeState.pointCount - rendered);
    drawAttractorPoints(printCanvas, activeState, exportCursor, pointsThisChunk, widthPx, heightPx);
    rendered += pointsThisChunk;

    if (rendered >= nextProgress || rendered >= activeState.pointCount) {
      println("  rendered " + rendered + " / " + activeState.pointCount + " points");
      nextProgress += EXPORT_PROGRESS_POINTS;
    }
  }

  printCanvas.endDraw();
  printCanvas.save(pngPath);
  saveMetadata(metadataPath, activeState, activeState.pointCount, widthPx, heightPx);

  println("Saved print PNG: " + pngPath);
  println("Saved metadata: " + metadataPath);
}

void savePreview() {
  String outputFolder = ensureOutputFolder();
  String stamp = timestamp();
  String baseName = "clifford-attractor-basic-preview-" + PREVIEW_SIZE + "x" + PREVIEW_SIZE + "-" + stamp;
  String pngPath = uniquePath(outputFolder, baseName, "png");
  previewCanvas.save(pngPath);
  println("Saved preview PNG: " + pngPath);
}

void drawAttractorPoints(PGraphics target, AttractorState state, DrawCursor cursor, int pointCount, int targetW, int targetH) {
  // fitScaleForCanvas constrains both axes independently; on non-square canvases the
  // attractor still fits but is centered (letterboxed on the longer axis).
  float fitScale = fitScaleForCanvas(state, targetW, targetH);
  Palette palette = palettes[state.paletteIndex];

  target.pushMatrix();
  target.translate(targetW * 0.5, targetH * 0.5);
  target.scale(fitScale);
  target.translate(-state.centerX, -state.centerY);
  target.strokeWeight(SCREEN_STROKE_WEIGHT / fitScale);
  target.stroke(palette.pointR, palette.pointG, palette.pointB, palette.alpha);

  for (int i = 0; i < pointCount; i++) {
    float nextX = sin(state.a * cursor.y) + state.c * cos(state.a * cursor.x);
    float nextY = sin(state.b * cursor.x) + state.d * cos(state.b * cursor.y);
    cursor.x = nextX;
    cursor.y = nextY;
    target.point(cursor.x, cursor.y);
  }

  target.popMatrix();
}

void clearPreviewAndWindow(int paletteIndex) {
  clearPreviewCanvas(paletteIndex);
  clearBackground(g, paletteIndex);
}

void clearPreviewCanvas(int paletteIndex) {
  previewCanvas.beginDraw();
  clearBackground(previewCanvas, paletteIndex);
  previewCanvas.endDraw();
}

void clearBackground(PGraphics target, AttractorState state) {
  clearBackground(target, state.paletteIndex);
}

void clearBackground(PGraphics target, int paletteIndex) {
  Palette palette = palettes[paletteIndex];
  target.pushStyle();
  target.pushMatrix();
  target.resetMatrix();
  target.blendMode(REPLACE);
  target.noStroke();
  target.fill(palette.backgroundR, palette.backgroundG, palette.backgroundB, 255);
  target.rect(0, 0, target.width, target.height);
  target.blendMode(BLEND);
  target.popMatrix();
  target.popStyle();
}

float fitScaleForCanvas(AttractorState state, int targetW, int targetH) {
  float rangeX = state.maxX - state.minX;
  float rangeY = state.maxY - state.minY;
  return min((targetW * state.fitMargin) / rangeX, (targetH * state.fitMargin) / rangeY);
}

FitBounds measureBounds(float candidateA, float candidateB, float candidateC, float candidateD, float seedX, float seedY) {
  float sampleX = seedX;
  float sampleY = seedY;
  float minX = Float.MAX_VALUE;
  float maxX = -Float.MAX_VALUE;
  float minY = Float.MAX_VALUE;
  float maxY = -Float.MAX_VALUE;

  for (int i = 0; i < WARMUP_POINTS + FIT_SAMPLE_POINTS; i++) {
    float nextX = sin(candidateA * sampleY) + candidateC * cos(candidateA * sampleX);
    float nextY = sin(candidateB * sampleX) + candidateD * cos(candidateB * sampleY);
    sampleX = nextX;
    sampleY = nextY;

    if (Float.isNaN(sampleX) || Float.isNaN(sampleY) || Float.isInfinite(sampleX) || Float.isInfinite(sampleY)) {
      return null;
    }

    if (i >= WARMUP_POINTS) {
      minX = min(minX, sampleX);
      maxX = max(maxX, sampleX);
      minY = min(minY, sampleY);
      maxY = max(maxY, sampleY);
    }
  }

  float rangeX = maxX - minX;
  float rangeY = maxY - minY;

  if (rangeX < 0.5 || rangeY < 0.5) {
    return null;
  }

  FitBounds bounds = new FitBounds();
  bounds.minX = minX;
  bounds.maxX = maxX;
  bounds.minY = minY;
  bounds.maxY = maxY;
  return bounds;
}

void skipWarmup(AttractorState state, DrawCursor cursor) {
  for (int i = 0; i < WARMUP_POINTS; i++) {
    float nextX = sin(state.a * cursor.y) + state.c * cos(state.a * cursor.x);
    float nextY = sin(state.b * cursor.x) + state.d * cos(state.b * cursor.y);
    cursor.x = nextX;
    cursor.y = nextY;
  }
}

float randomCoefficient() {
  float sign = random(1) < 0.5 ? -1 : 1;
  return sign * random(0.45, 2.75);
}

int randomPointCount() {
  return floor(random(MIN_POINTS, MAX_POINTS + 1));
}

Palette[] loadPalettes() {
  String palettePath = sketchPath(PALETTE_FILE);
  String[] lines = null;

  try {
    lines = loadStrings(palettePath);
  } catch (Exception e) {
    println("Could not read palette YAML at " + palettePath + ". Using fallback palette.");
    return fallbackPalettes();
  }

  if (lines == null) {
    println("Could not read palette YAML at " + palettePath + ". Using fallback palette.");
    return fallbackPalettes();
  }

  ArrayList<Palette> loaded = new ArrayList<Palette>();
  String name = null;
  int[] background = null;
  int[] points = null;
  int alpha = -1;

  for (int i = 0; i < lines.length; i++) {
    String line = lines[i].trim();

    if (line.length() == 0 || line.startsWith("#") || line.equals("palettes:")) {
      continue;
    }

    if (line.startsWith("- ")) {
      addPaletteIfValid(loaded, name, background, points, alpha);
      name = null;
      background = null;
      points = null;
      alpha = -1;
      line = line.substring(2).trim();
    }

    if (line.startsWith("name:")) {
      name = valueAfterColon(line);
    } else if (line.startsWith("background:")) {
      background = parseRgbList(valueAfterColon(line));
    } else if (line.startsWith("points:")) {
      points = parseRgbList(valueAfterColon(line));
    } else if (line.startsWith("alpha:")) {
      alpha = parseAlpha(valueAfterColon(line));
    }
  }

  addPaletteIfValid(loaded, name, background, points, alpha);

  if (loaded.size() == 0) {
    println("No valid palettes found in " + palettePath + ". Using fallback palette.");
    return fallbackPalettes();
  }

  Palette[] parsed = new Palette[loaded.size()];
  for (int i = 0; i < loaded.size(); i++) {
    parsed[i] = loaded.get(i);
  }

  println("Loaded " + parsed.length + " curated palettes from " + palettePath + ".");
  return parsed;
}

void addPaletteIfValid(ArrayList<Palette> loaded, String name, int[] background, int[] points, int alpha) {
  if (name == null && background == null && points == null && alpha < 0) {
    return;
  }

  if (name == null || name.length() == 0 || background == null || points == null || alpha < 0) {
    println("Skipping malformed palette entry in " + PALETTE_FILE + ".");
    return;
  }

  loaded.add(new Palette(name, background[0], background[1], background[2], points[0], points[1], points[2], alpha));
}

String valueAfterColon(String line) {
  int colon = line.indexOf(':');

  if (colon < 0 || colon == line.length() - 1) {
    return "";
  }

  return line.substring(colon + 1).trim();
}

int[] parseRgbList(String value) {
  String cleanValue = value.replace("[", "").replace("]", "").trim();
  String[] pieces = split(cleanValue, ',');

  if (pieces.length != 3) {
    return null;
  }

  int[] rgb = new int[3];

  for (int i = 0; i < pieces.length; i++) {
    int channel = parseChannel(pieces[i].trim());

    if (channel < 0) {
      return null;
    }

    rgb[i] = channel;
  }

  return rgb;
}

int parseAlpha(String value) {
  return parseChannel(value.trim());
}

int parseChannel(String value) {
  try {
    int channel = Integer.parseInt(value);

    if (channel < 0 || channel > 255) {
      return -1;
    }

    return channel;
  } catch (Exception e) {
    return -1;
  }
}

Palette[] fallbackPalettes() {
  Palette[] fallback = new Palette[1];
  fallback[0] = new Palette("fallback_black_on_white", 255, 255, 255, 0, 0, 0, 30);
  return fallback;
}

Palette activePalette() {
  return palettes[activeState.paletteIndex];
}

String ensureOutputFolder() {
  String folder = sketchPath("../../../outputs/" + SKETCH_NAME);
  File outputDir = new File(folder);

  if (!outputDir.exists()) {
    outputDir.mkdirs();
  }

  return folder;
}

String uniqueBasePath(String folder, String baseName) {
  String basePath = folder + "/" + baseName;

  if (!new File(basePath + ".png").exists() && !new File(basePath + ".txt").exists()) {
    return basePath;
  }

  for (int copy = 2; copy < 1000; copy++) {
    String candidate = basePath + "-" + nf(copy, 3);
    if (!new File(candidate + ".png").exists() && !new File(candidate + ".txt").exists()) {
      return candidate;
    }
  }

  return basePath + "-" + millis();
}

String uniquePath(String folder, String baseName, String extension) {
  String path = folder + "/" + baseName + "." + extension;

  if (!new File(path).exists()) {
    return path;
  }

  for (int copy = 2; copy < 1000; copy++) {
    String candidate = folder + "/" + baseName + "-" + nf(copy, 3) + "." + extension;
    if (!new File(candidate).exists()) {
      return candidate;
    }
  }

  return folder + "/" + baseName + "-" + millis() + "." + extension;
}

String timestamp() {
  return nf(year(), 4) + nf(month(), 2) + nf(day(), 2) + "-" + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
}

void saveMetadata(String path, AttractorState state, int pointCount, int pixelWidth, int pixelHeight) {
  PrintWriter writer = createWriter(path);
  writer.println("sketch=" + SKETCH_NAME);
  writer.println("file_type=PNG");
  writer.println("pixel_size=" + pixelWidth + "x" + pixelHeight);
  writer.println("intended_print_size_inches=" + imageConfig.widthInches + "x" + imageConfig.heightInches);
  writer.println("dpi=" + imageConfig.dpi);
  writer.println("point_count=" + pointCount);
  writer.println("a=" + state.a);
  writer.println("b=" + state.b);
  writer.println("c=" + state.c);
  writer.println("d=" + state.d);
  writer.println("seed_x=" + state.seedX);
  writer.println("seed_y=" + state.seedY);
  writer.println("palette_index=" + state.paletteIndex);
  writer.println("palette_name=" + palettes[state.paletteIndex].name);
  writer.println("point_count_min=" + MIN_POINTS);
  writer.println("point_count_max=" + MAX_POINTS);
  writer.println("fit_margin=" + state.fitMargin);
  writer.println("fit_min_x=" + state.minX);
  writer.println("fit_max_x=" + state.maxX);
  writer.println("fit_min_y=" + state.minY);
  writer.println("fit_max_y=" + state.maxY);
  writer.println("fit_center_x=" + state.centerX);
  writer.println("fit_center_y=" + state.centerY);
  writer.flush();
  writer.close();
}

class AttractorState {
  float a;
  float b;
  float c;
  float d;
  float seedX;
  float seedY;
  int paletteIndex;
  int pointCount;
  float minX;
  float maxX;
  float minY;
  float maxY;
  float centerX;
  float centerY;
  float fitMargin;
}

class Palette {
  String name;
  int backgroundR;
  int backgroundG;
  int backgroundB;
  int pointR;
  int pointG;
  int pointB;
  int alpha;

  Palette(String paletteName, int bgR, int bgG, int bgB, int inkR, int inkG, int inkB, int inkAlpha) {
    name = paletteName;
    backgroundR = bgR;
    backgroundG = bgG;
    backgroundB = bgB;
    pointR = inkR;
    pointG = inkG;
    pointB = inkB;
    alpha = inkAlpha;
  }
}

class DrawCursor {
  float x;
  float y;

  DrawCursor(float startX, float startY) {
    x = startX;
    y = startY;
  }
}

class FitBounds {
  float minX;
  float maxX;
  float minY;
  float maxY;
}

class ImageConfig {
  float widthInches;
  float heightInches;
  int dpi;
  int widthPx;
  int heightPx;
}

ImageConfig loadImageConfig(String sketchName) {
  String configPath = sketchPath(IMAGE_CONFIG_FILE);
  String[] lines = null;

  try {
    lines = loadStrings(configPath);
  } catch (Exception e) {
    lines = null;
  }

  if (lines == null) {
    println("Could not read image config at " + configPath + ". Falling back to 16 in x 16 in at 300 dpi.");
    return fallbackImageConfig();
  }

  ImageConfig cfg = new ImageConfig();
  cfg.widthInches = 16.0;
  cfg.heightInches = 16.0;
  cfg.dpi = 300;

  // First pass: top-level dpi and the `square:` block (the defaults).
  String section = "";
  for (int i = 0; i < lines.length; i++) {
    String raw = lines[i];
    String trimmed = raw.trim();
    if (trimmed.length() == 0 || trimmed.startsWith("#")) continue;

    int indent = leadingSpaces(raw);
    if (indent == 0) {
      if (trimmed.startsWith("dpi:")) {
        cfg.dpi = parseIntValue(valueAfterColon(trimmed), cfg.dpi);
      } else if (trimmed.startsWith("square:")) {
        section = "square";
      } else if (trimmed.startsWith("sketches:")) {
        section = "sketches";
      } else if (trimmed.startsWith("rectangular:")) {
        section = "rectangular";
      } else {
        section = "";
      }
    } else if (section.equals("square") && indent == 2) {
      applyKeyValue(trimmed, cfg);
    }
  }

  // Second pass: apply per-sketch overrides.
  applySketchOverride(lines, sketchName, cfg);

  cfg.widthPx = round(cfg.widthInches * cfg.dpi);
  cfg.heightPx = round(cfg.heightInches * cfg.dpi);
  return cfg;
}

void applySketchOverride(String[] lines, String sketchName, ImageConfig cfg) {
  boolean inSketches = false;
  boolean inEntry = false;
  String prefix = sketchName + ":";

  for (int i = 0; i < lines.length; i++) {
    String raw = lines[i];
    String trimmed = raw.trim();
    if (trimmed.length() == 0 || trimmed.startsWith("#")) continue;

    int indent = leadingSpaces(raw);

    if (indent == 0) {
      inSketches = trimmed.startsWith("sketches:");
      inEntry = false;
      continue;
    }

    if (!inSketches) continue;

    if (indent == 2) {
      if (trimmed.startsWith(prefix)) {
        String rest = trimmed.substring(prefix.length()).trim();
        if (rest.startsWith("{") && rest.endsWith("}")) {
          String inner = rest.substring(1, rest.length() - 1).trim();
          parseInlineMap(inner, cfg);
          inEntry = false;
        } else if (rest.length() == 0) {
          inEntry = true;
        } else {
          inEntry = false;
        }
      } else {
        inEntry = false;
      }
    } else if (indent == 4 && inEntry) {
      applyKeyValue(trimmed, cfg);
    }
  }
}

void parseInlineMap(String inner, ImageConfig cfg) {
  String[] parts = split(inner, ',');
  for (int i = 0; i < parts.length; i++) {
    applyKeyValue(parts[i].trim(), cfg);
  }
}

void applyKeyValue(String kv, ImageConfig cfg) {
  int colon = kv.indexOf(':');
  if (colon < 0) return;
  String key = kv.substring(0, colon).trim();
  String value = kv.substring(colon + 1).trim();
  if (key.equals("width_inches")) {
    cfg.widthInches = parseFloatValue(value, cfg.widthInches);
  } else if (key.equals("height_inches")) {
    cfg.heightInches = parseFloatValue(value, cfg.heightInches);
  } else if (key.equals("dpi")) {
    cfg.dpi = parseIntValue(value, cfg.dpi);
  }
  // `shape: square` is implicit (square defaults already loaded);
  // `shape: rectangular` requires explicit width/height per sketch.
}

int leadingSpaces(String s) {
  int count = 0;
  while (count < s.length() && s.charAt(count) == ' ') count++;
  return count;
}

int parseIntValue(String s, int fallback) {
  try {
    return Integer.parseInt(s);
  } catch (Exception e) {
    return fallback;
  }
}

float parseFloatValue(String s, float fallback) {
  try {
    return Float.parseFloat(s);
  } catch (Exception e) {
    return fallback;
  }
}

ImageConfig fallbackImageConfig() {
  ImageConfig cfg = new ImageConfig();
  cfg.widthInches = 16.0;
  cfg.heightInches = 16.0;
  cfg.dpi = 300;
  cfg.widthPx = 4800;
  cfg.heightPx = 4800;
  return cfg;
}
