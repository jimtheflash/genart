# AGENTS.md

This repository is a generative art playground. The main goal is to make digital images through creative code, learn interesting visual systems, and keep the project welcoming for experimentation.

## Project Intent

- Explore attractors and dynamical systems, starting with Clifford attractors and branching into related systems such as De Jong, Hopalong, Hénon, Ikeda, Gumowski-Mira, Tinkerbell, Lorenz, and reaction-diffusion.
- Explore genetic algorithms, geometric grids, flow fields, tilings, noise, particle systems, cellular automata, and image-based transformations.
- Support multiple languages over time: Processing, p5.js, Python, R, Rust, C++, and Julia.
- Favor sketches that can produce compelling still images first; animation and interactivity are welcome when they serve the image.

## Repository Structure

- `sketches/processing/`: Processing Java-mode sketches, each in its own folder named the same as the `.pde` file.
- `sketches/p5js/`: Browser sketches using p5.js.
- `sketches/python/`: Python sketches, notebooks, and image generation experiments.
- `sketches/r/`: R sketches and plotting experiments.
- `sketches/rust/`: Rust experiments and performance-focused generators.
- `sketches/cpp/`: C++ experiments and performance-focused generators.
- `sketches/julia/`: Julia experiments and numerical/image generation sketches.
- `lib/`: Shared helpers, palettes, formulas, and reusable notes.
- `assets/`: Source images, texture references, masks, fonts, or other input assets.
- `outputs/`: Generated images and renders. Prefer placing outputs in a subfolder named after the sketch.
- `docs/`: Learning notes, references, prompts, and explanations of systems.

## Coding Guidance

- Keep sketches small, legible, and easy to run.
- When adding a new sketch, include brief comments near the top explaining what it does and how to run it.
- The user is learning Processing and Rust, and has limited experience with C++ and Julia. Prefer approachable examples with clear names over overly compressed clever code.
- Preserve randomness as a creative tool, but use seeds when reproducibility would help compare outputs.
- Prefer parameter blocks near the top of sketches so the interesting knobs are easy to find.
- Save generated images into `outputs/<sketch-name>/` when practical.
- Static-image sketches should read their canvas dimensions from `image_config.yml` at the repo root and expose `--width-inches` / `--height-inches` / `--dpi` (or their YAML equivalents) for overrides, so sizing stays consistent across languages.
- Avoid overwriting existing output files unless the user explicitly asks for that.
- Use language-native package managers and document any nonstandard dependency in the sketch folder or language README.
- Do not introduce heavy frameworks unless they clearly help with rendering, performance, or creative exploration.

## Visual Taste

- Prioritize rich images, surprising structure, and good defaults.
- It is fine for sketches to be playful, experimental, or unfinished as long as they run.
- Add comments for the math or algorithmic idea when that would help future learning.
- For attractors and iterative systems, expose coefficients, iteration counts, color palettes, scale, and fade/alpha controls.

## Agent Behavior

- Read nearby files before changing a sketch.
- Keep changes scoped to the requested sketch, language, or documentation.
- Do not delete generated work or source assets without explicit permission.
- When adding runnable code, also provide concise run instructions.
