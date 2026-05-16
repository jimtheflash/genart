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
- `e`: render and save a `4800 x 4800` print PNG to `outputs/clifford_attractor_basic/`.

Each new attractor uses a randomized point count between 9M and 10M points. The high-resolution export is sized for a 16 inch square print at 300 dpi, and it uses the same point count, coefficients, seed, palette, and bounds as the preview. It also writes a matching `.txt` metadata file with the print details.

Shared palettes live in `palettes.yml`.
