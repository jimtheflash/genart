# genart

Generative art experiments across attractors, genetic algorithms, geometric grids, noise, and whatever else starts making good images.

This repo is intentionally multi-language. Processing and p5.js are good for fast visual sketches, Python and R are good for exploratory work, and Rust/C++/Julia are here for future performance-heavy experiments.

## Structure

- `sketches/processing/`: Processing Java-mode sketches.
- `sketches/p5js/`: Browser sketches using p5.js.
- `sketches/python/`: Python experiments.
- `sketches/r/`: R experiments.
- `sketches/rust/`: Rust experiments.
- `sketches/cpp/`: C++ experiments.
- `sketches/julia/`: Julia experiments.
- `palettes.yml`: Shared color palettes for sketches.
- `image_config.yml`: Default print dimensions (width/height in inches + dpi) for static-image sketches.
- `lib/`: Shared helpers, formulas, and reusable notes.
- `assets/`: Input assets.
- `outputs/`: Generated images.
- `docs/`: Notes about systems and techniques to explore.

## First Sketch

The first example is a Clifford attractor:

- Processing Java mode: `sketches/processing/clifford_attractor_basic/clifford_attractor_basic.pde`

The Processing sketch is the canonical Clifford implementation because it can render larger offscreen PNGs for print.

## Running The Processing Sketch

Install Processing from <https://processing.org/download>, then open:

```text
sketches/processing/clifford_attractor_basic/clifford_attractor_basic.pde
```

Click the Run button in the Processing IDE.

In VS Code, install a Processing extension and configure it to use the Processing command-line runner. Then open the sketch folder and run the `.pde` file through the extension.

## Clifford Attractor Controls

- `n`: generate a new attractor and restart the preview.
- `s`: save the current `900 x 900` preview PNG to `outputs/clifford_attractor_basic/`.
- `e`: render and save the print PNG (dimensions from `image_config.yml`) to `outputs/clifford_attractor_basic/`.

Each new attractor uses a randomized point count between 9M and 10M points. The high-resolution export defaults to a 16 inch square print at 300 dpi (4800 × 4800 px), and it uses the same point count, coefficients, seed, palette, and bounds as the preview. It also writes a matching `.txt` metadata file with the print details.

## Default Print Dimensions

Static-image sketches read their canvas size and resolution from
[`image_config.yml`](image_config.yml) at the repo root. Defaults:

- 16 in × 16 in at 300 dpi for square sketches (4800 × 4800 px)
- Rectangular sketches should pick `width_inches` × `height_inches` totaling 256 in² (the same wall area)
- Override per-sketch in the same YAML, or on the Rust CLIs with
  `--width-inches`, `--height-inches`, `--dpi`

Shared palettes live in `palettes.yml`.
